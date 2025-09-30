let observerObject
let observerCreationCallbacks = { idCallbacks: {}, tagCallbacks: {}, classCallbacks: {} }
let observerDeletionCallbacks = { idCallbacks: {}, tagCallbacks: {}, classCallbacks: {} }

function observerSubscribeToElement(target, callback, callbackList) {
  function push(target, callback, observerMap) {
    let v = observerMap[target]

    if (v === undefined) {
      observerMap[target] = [callback]
    } else {
      v.push(callback)
    }
  }

  if (target[0] === '.') {
    push(target.slice(1), callback, callbackList.classCallbacks)
  } else if (target[0] === '#') {
    push(target.slice(1), callback, callbackList.idCallbacks)
  } else {
    push(target, callback, callbackList.tagCallbacks)
  }
}

export function subscribeToElementCreation(target, callback) {
  observerSubscribeToElement(target, callback, observerCreationCallbacks)
}

export function subscribeToElementDeletion(target, callback) {
  observerSubscribeToElement(target, callback, observerDeletionCallbacks)
}

function observerHandleElement(element, isNew, callbacks) {
  if (element.id != "") {
    const cb = callbacks.idCallbacks[element.id]
    if (cb != undefined) {
      for (const obj of cb) {
        obj(element)
      }
    }
  }

  const tagLowered = element.tagName.toLowerCase()
  const cb = callbacks.tagCallbacks[tagLowered]
  if (cb != undefined) {
    for (const obj of cb) {
      obj(element)
    }
  }

  const classList = element.classList
  if (classList) {
    for (const nodeClass of classList) {
      const classLowered = nodeClass.toLowerCase()
      const cb = callbacks.classCallbacks[classLowered]
      if (cb != undefined) {
        for (const obj of cb) {
          obj(element)
        }
      }
    }
  }

  if (isNew && element.shadowRoot != null) {
    const handleChildren = (element, isNew, callbacks) => {
      observerHandleElement(element, isNew, callbacks)

      for (const child of element.children) {
        handleChildren(child, isNew, callbacks)
      }
    }

    for (const child of element.shadowRoot.children) {
      handleChildren(child, isNew, callbacks)
    }

    observerObject.observe(element.shadowRoot, { attributes: false, childList: true, subtree: true })
  }
}

function observerCallback(mutationsList) {
  for (const mutation of mutationsList) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observerHandleElement(node, true, observerCreationCallbacks)
      }
    }

    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        observerHandleElement(node, false, observerDeletionCallbacks)
      }
    }
  }
}

function periodicElementCheck() {
  const allElements = document.getElementsByTagName('*');
  for (const element of allElements) {
    observerHandleElement(element, true, observerCreationCallbacks);
  }
}

observerObject = new MutationObserver(observerCallback);
observerObject.observe(document, { attributes: false, childList: true, subtree: true });

setInterval(periodicElementCheck, 1000);