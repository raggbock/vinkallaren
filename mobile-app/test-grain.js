// Paste this in browser console, or load as a script
var svgData = encodeURIComponent("<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.06'/></svg>");
var bgUrl = "url(\"data:image/svg+xml," + svgData + "\")";
var count = 0;
document.querySelectorAll("div").forEach(function(d) {
  if (getComputedStyle(d).backgroundColor === "rgb(248, 241, 232)") {
    d.style.backgroundImage = bgUrl;
    d.style.backgroundSize = "200px";
    count++;
  }
});
console.log("Applied grain to " + count + " panels");
