// Shrink-to-fit for the printed bill / invoice. The footer (signature,
// thank-you, hospital address) is the last block; when the list itself fits on
// one page but list + footer is only a little too tall, the footer used to be
// pushed alone onto a second page. This measures the content at load time and,
// if it overflows the printable height by up to (1 - minScale), exposes a
// --fit scale that the print CSS applies with `zoom`, so everything — footer
// included — lands on page 1. Genuinely long bills (beyond that) are left to
// break across pages normally.
//
// The measure runs against the preview iframe, whose width equals the paper
// width (see previewIframeStyle), so the body's content box matches the
// printed content width and line wrapping — hence height — is the same.
export const fitToPageCss = (printableMm) =>
  `@media print { body { zoom: var(--fit, 1); min-height: calc(${printableMm}mm / var(--fit, 1)); } }`;

export const fitToPageScript = ({ printableMm, printPadPx = 0, minScale = 0.7 }) => `<script>
(function () {
  function fit() {
    var pc = document.querySelector('.page-content');
    var pf = document.querySelector('.print-footer');
    if (!pc || !pf) return;
    var prevFlex = pc.style.flex;
    pc.style.flex = 'none';               // natural content height, not stretched
    var natural = pc.offsetHeight + pf.offsetHeight + parseFloat(getComputedStyle(pf).marginTop || 0) + ${printPadPx};
    pc.style.flex = prevFlex;
    var avail = ${printableMm} * 96 / 25.4;
    var scale = avail / natural;
    if (scale < 1 && scale >= ${minScale}) {
      document.documentElement.style.setProperty('--fit', scale.toFixed(4));
    }
  }
  if (document.readyState === 'complete') fit(); else window.addEventListener('load', fit);
})();
</script>`;
