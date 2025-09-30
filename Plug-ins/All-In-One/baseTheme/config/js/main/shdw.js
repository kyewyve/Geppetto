export function banner_clear_css(element) {
    const root = element.shadowRoot;
    const rootStyle = document.createElement("style");
    rootStyle.textContent = `
        :host .regalia-banner-v2-root[member-type="current-player"] .regalia-banner-asset-static-background {
          opacity: 0;
        }
        :host .regalia-banner-v2-root[member-type="current-player"] .regalia-banner-asset-static-image {
          opacity: 0;
        }
        :host .regalia-banner-v2-root {
          opacity: 0;
        }
        :host .regalia-banner-v2-root[member-type="other-player"] {
          opacity: 1 !important;
        }
    `;
    root.appendChild(rootStyle);
}