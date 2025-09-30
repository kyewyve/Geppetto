/**
* @author kye
* @link https://github.com/kyewyve/Geppetto
*/
window.Effect.apply('unified', { color: "#000000DA" });

import "https://cdn.skypack.dev/autoaccept?min"

// CSS
import "./theme.css";

// JS
//import "./preload.js";

// OTHER
import * as observer from './config/js/main/obs.js'
import * as shadow_dom from './config/js/main/shdw.js'

observer.subscribeToElementCreation('lol-regalia-banner-v2-element', (element) => {
    shadow_dom.banner_clear_css(element)

})