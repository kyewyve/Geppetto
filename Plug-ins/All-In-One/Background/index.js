/**
* @author Unknown
* @link https://github.com/kyewyve/Geppetto
*/

class UPLContext {
    constructor(context) {
        this.Context = context;
    }
}

let globalInstance;

function initializeUPL(context) {
    if (globalInstance != null) throw new Error("UPL is already initialized!");
    globalInstance = new UPLContext(context);
}

class Trigger {
    constructor(callback) {
        this._callback = callback;
    }
    
    trigger() {
        if (this._callback !== undefined) {
            this._callback();
            this._callback = undefined;
        }
    }
}

let mutationObserver;
const domReadyTrigger = new Trigger(initializeDOMObserver);
const creationCallbacks = [];
const deletionCallbacks = [];

function elementMatches(element, selector) {
    return Element.prototype.matches.call(element, selector);
}

function processElementTree(element, isAddition) {
    if (isAddition) {
        for (const callback of creationCallbacks) {
            if (elementMatches(element, callback.selector)) {
                callback.callback(element);
            }
        }
    } else {
        for (const callback of deletionCallbacks) {
            if (elementMatches(element, callback.selector)) {
                callback.callback(element);
            }
        }
    }
    
    for (const child of element.children) {
        processElementTree(child, isAddition);
    }
    
    if (element.shadowRoot != null) {
        for (const child of element.shadowRoot.children) {
            processElementTree(child, isAddition);
        }
        
        if (isAddition) {
            mutationObserver.observe(element.shadowRoot, {
                attributes: false,
                childList: true,
                subtree: true
            });
        }
    }
}

function handleMutations(mutations) {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                processElementTree(node, true);
            }
        }
        
        for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                processElementTree(node, false);
            }
        }
    }
}

function initializeDOMObserver() {
    mutationObserver = new MutationObserver(handleMutations);
    mutationObserver.observe(document, {
        attributes: false,
        childList: true,
        subtree: true
    });
}

function subscribeToElementCreation(selector, callback) {
    domReadyTrigger.trigger();
    creationCallbacks.push({ selector, callback });
}

function subscribeToElementDeletion(selector, callback) {
    domReadyTrigger.trigger();
    deletionCallbacks.push({ selector, callback });
}

let loadCallbacks = [];
let loadTriggered = false;
let loadExecuted = false;

function subscribeToLoad(callback) {
    if (!loadTriggered) {
        loadTriggered = true;
        subscribeToElementDeletion(".lol-loading-screen-container", () => {
            if (!loadExecuted) {
                loadExecuted = true;
                for (let cb of loadCallbacks) cb();
            }
        });
    }
    loadCallbacks.push(callback);
}

const DOMObserver = Object.freeze(
    Object.defineProperty({
        subscribeToElementCreation,
        subscribeToElementDeletion,
        subscribeToLoad
    }, Symbol.toStringTag, { value: "Module" })
);

let xhrHooks = {};
const xhrReadyTrigger = new Trigger(initializeXHRHooks);

function hookXHRPre(url, callback) {
    xhrReadyTrigger.trigger();
    const existing = xhrHooks[url];
    
    if (existing === undefined) {
        xhrHooks[url] = { pre_callback: callback, post_callback: undefined };
    } else {
        existing.pre_callback = callback;
    }
}

function hookXHRPost(url, callback) {
    xhrReadyTrigger.trigger();
    const existing = xhrHooks[url];
    
    if (existing === undefined) {
        xhrHooks[url] = { pre_callback: undefined, post_callback: callback };
    } else {
        existing.post_callback = callback;
    }
}

function hookTextXHRPre(url, callback) {
    hookXHRPre(url, (xhr, body, next) => {
        if (typeof body !== "string") {
            console.error("UPL: Tried to hook text XHR request but body is not a string!");
            return next(body);
        }
        
        callback(body, modifiedBody => {
            next(modifiedBody);
        });
    });
}

function hookTextXHRPost(url, callback) {
    hookXHRPost(url, (xhr, next) => {
        if (xhr.responseType !== "" && xhr.responseType !== "text") {
            console.error("UPL: Tried to hook text XHR request but response is not a string!");
            return next();
        }
        
        const modifyResponse = modifiedText => {
            if (xhr.responseText !== modifiedText) {
                Object.defineProperty(xhr, "responseText", {
                    writable: true,
                    value: modifiedText
                });
            }
            next();
        };
        
        callback(xhr.responseText, modifyResponse);
    });
}

const originalXHROpen = XMLHttpRequest.prototype.open;

function hookedXHROpen(method, url) {
    const hook = xhrHooks[url.toString()];
    
    if (hook !== undefined) {
        const originalSend = this.send;
        
        this.send = function(body) {
            if (body instanceof Document) {
                return originalSend.apply(this, [body]);
            }
            
            if (hook.pre_callback !== undefined) {
                const modifyBody = modifiedBody => {
                    body = modifiedBody;
                };
                hook.pre_callback(this, body || null, modifyBody);
            }
            
            if (hook.post_callback !== undefined) {
                const originalOnReadyStateChange = this.onreadystatechange;
                
                this.onreadystatechange = function(event) {
                    if (this.readyState === 4 && hook.post_callback !== undefined) {
                        const continueProcessing = () => {
                            originalOnReadyStateChange.apply(this, [event]);
                        };
                        
                        hook.post_callback(this, continueProcessing);
                        return;
                    }
                    
                    return originalOnReadyStateChange.apply(this, arguments);
                };
            }
            
            originalSend.apply(this, [body]);
        };
    }
    
    originalXHROpen.apply(this, arguments);
}

function initializeXHRHooks() {
    XMLHttpRequest.prototype.open = hookedXHROpen;
}

const XHRHookManager = Object.freeze(
    Object.defineProperty({
        hookPost: hookXHRPost,
        hookPre: hookXHRPre,
        hookTextPost: hookTextXHRPost,
        hookTextPre: hookTextXHRPre
    }, Symbol.toStringTag, { value: "Module" })
);

let websocketHooks = {};
const websocketReadyTrigger = new Trigger(initializeWebSocketHooks);

function hookWebSocket(endpoint, callback) {
    websocketReadyTrigger.trigger();
    websocketHooks[endpoint] = callback;
}

function hookTextWebSocket(endpoint, callback) {
    hookWebSocket(endpoint, (message, next) => {
        if (typeof message !== "string") {
            console.error("UPL: Tried to hook text websocket endpoint but content is not a string!");
            return next(message);
        }
        
        callback(message, modifiedMessage => {
            next(modifiedMessage);
        });
    });
}

function initializeWebSocketHooks() {
    const context = globalInstance?.Context;
    if (context == null) throw new Error("UPL is not initialized!");
    
    context.rcp.postInit("rcp-fe-common-libs", async libs => {
        const originalGetDataBinding = libs.getDataBinding;
        
        libs.getDataBinding = async function(name) {
            const originalBinding = await originalGetDataBinding.apply(this, arguments);
            
            const hookedBinding = function(method, params) {
                const binding = originalBinding.apply(this, arguments);
                const cache = binding.cache;
                const originalTrigger = cache._triggerResourceObservers;
                
                cache._triggerResourceObservers = function(resource, data, metadata) {
                    const hook = websocketHooks[resource];
                    
                    if (hook == null) {
                        return originalTrigger.apply(this, [resource, data, metadata]);
                    }
                    
                    return hook(data, modifiedData => {
                        originalTrigger.apply(this, [resource, modifiedData, metadata]);
                    });
                };
                
                return binding;
            };
            
            hookedBinding.bindTo = function(context) {
                const bound = originalBinding.bindTo.apply(this, arguments);
                bound.dataBinding = hookedBinding;
                return bound;
            };
            
            return Promise.resolve(hookedBinding);
        };
    });
}

const WebSocketHookManager = Object.freeze(
    Object.defineProperty({
        hook: hookWebSocket,
        hookText: hookTextWebSocket
    }, Symbol.toStringTag, { value: "Module" })
);

const emberHooks = new Map();
const emberMatcherHooks = [];
const emberReadyTrigger = new Trigger(initializeEmberHooks);

function hookComponentMethodByName(componentName, methodName, callback) {
    emberReadyTrigger.trigger();
    const hook = { method: methodName, callback };
    const existing = emberHooks.get(componentName);
    
    if (existing === undefined) {
        emberHooks.set(componentName, { hooks: [hook], mixins: [] });
    } else {
        existing.hooks.push(hook);
    }
}

function hookComponentMethodByMatching(matcher, methodName, callback) {
    emberReadyTrigger.trigger();
    const hook = { method: methodName, callback };
    emberMatcherHooks.push({
        matcher,
        entry: { hooks: [hook], mixins: [] }
    });
}

function extendComponentByName(componentName, mixin) {
    emberReadyTrigger.trigger();
    const existing = emberHooks.get(componentName);
    
    if (existing === undefined) {
        emberHooks.set(componentName, { hooks: [], mixins: [mixin] });
    } else {
        existing.mixins.push(mixin);
    }
}

function extendComponentByMatching(matcher, mixin) {
    emberReadyTrigger.trigger();
    emberMatcherHooks.push({
        matcher,
        entry: { hooks: [], mixins: [mixin] }
    });
}

function initializeEmberHooks() {
    const context = globalInstance?.Context;
    if (context == null) throw new Error("UPL is not initialized!");
    
    context.rcp.postInit("rcp-fe-ember-libs", async emberLibs => {
        const originalGetEmber = emberLibs.getEmber;
        
        emberLibs.getEmber = function(...args) {
            const emberPromise = originalGetEmber.apply(this, args);
            
            return emberPromise.then(ember => {
                const originalExtend = ember.Component.extend;
                
                ember.Component.extend = function(...extendArgs) {
                    let component = originalExtend.apply(this, arguments);
                    
                    const options = extendArgs.filter(arg => typeof arg === "object");
                    
                    for (const option of options) {
                        for (const matcherHook of emberMatcherHooks) {
                            if (matcherHook.matcher(option)) {
                                component = applyEmberHooks(ember, matcherHook.entry, component);
                            }
                        }
                    }
                    
                    const classNames = options
                        .filter(opt => opt.classNames && Array.isArray(opt.classNames))
                        .map(opt => opt.classNames.join(" "));
                    
                    for (const className of classNames) {
                        const hook = emberHooks.get(className);
                        if (hook !== undefined) {
                            component = applyEmberHooks(ember, hook, component);
                        }
                    }
                    
                    return component;
                };
                
                return ember;
            });
        };
    });
}

function applyEmberHooks(ember, hookEntry, component) {
    const prototype = component.proto();
    
    if (prototype.__UPL_IS_HOOKED) return component;
    
    prototype.__UPL_IS_HOOKED = true;
    
    for (const mixin of hookEntry.mixins) {
        component = component.extend(mixin(ember));
    }
    
    for (const hook of hookEntry.hooks) {
        const originalMethod = prototype[hook.method];
        
        prototype[hook.method] = function(...args) {
            const callOriginal = (...originalArgs) => {
                if (originalMethod != null) {
                    return originalMethod.apply(this, originalArgs);
                }
            };
            
            return hook.callback.call(this, ember, callOriginal, ...args);
        };
    }
    
    return component;
}

const EmberHookManager = Object.freeze(
    Object.defineProperty({
        extendClassByMatching: extendComponentByMatching,
        extendClassByName: extendComponentByName,
        hookComponentMethodByMatching: hookComponentMethodByMatching,
        hookComponentMethodByName: hookComponentMethodByName
    }, Symbol.toStringTag, { value: "Module" })
);

const HookManagers = Object.freeze(
    Object.defineProperty({
        ember: EmberHookManager,
        ws: WebSocketHookManager,
        xhr: XHRHookManager
    }, Symbol.toStringTag, { value: "Module" })
);

function initializeContext(context) {
    if (context.rcp === undefined || 
        typeof context.rcp.preInit !== "function" || 
        typeof context.rcp.postInit !== "function") {
        throw new Error("context is not a valid context!");
    }
    
    initializeUPL(context);
}

const TIMESTAMP = 1566160778000;

function init(context) {
    initializeContext(context);
    
    DOMObserver.subscribeToLoad(async () => {
        const summoner = await (await fetch("/lol-summoner/v1/current-summoner")).json();
        
        HookManagers.xhr.hookPost(
            `/lol-champions/v1/inventories/${summoner.summonerId}/champions`,
            (xhr, next) => {
                if (document.querySelector(".style-profile-skin-picker-button")) {
                    const responseText = xhr.responseText;
                    let champions = JSON.parse(responseText);
                    
                    champions.forEach(champion => {
                        if (champion.ownership?.rental) {
                            champion.ownership.owned = true;
                            champion.ownership.rental.purchaseDate = TIMESTAMP;
                            champion.purchased = TIMESTAMP;
                        }
                        
                        champion.skins.forEach(skin => {
                            skin.ownership.owned = true;
                            
                            if (skin.questSkinInfo?.tiers?.length) {
                                skin.questSkinInfo.tiers.forEach(tier => {
                                    tier.ownership.owned = true;
                                });
                            }
                        });
                    });
                    
                    Object.defineProperty(xhr, "responseText", {
                        writable: true,
                        value: JSON.stringify(champions)
                    });
                }
                
                next();
            }
        );
    });
}

export { init };