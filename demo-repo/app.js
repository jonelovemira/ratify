// Counter logic for the demo page.

let count = 0;

function increment() {
  count += 1;
  return count;
}

// Browser-only wiring: skipped when the file is loaded outside a browser.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('count');
    document.getElementById('add').addEventListener('click', () => {
      output.textContent = String(increment());
    });
    output.textContent = String(count);
  });
}
