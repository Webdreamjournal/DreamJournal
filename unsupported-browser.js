// Loaded with <script nomodule>: shown only by browsers that cannot run ES modules.
document.body.textContent = '';
var box = document.createElement('div');
box.style.cssText = 'padding: 20px; text-align: center;';
var h = document.createElement('h2');
h.textContent = 'Browser Not Supported';
var p = document.createElement('p');
p.textContent = 'This application requires a modern browser that supports ES modules. Please update your browser or try Chrome, Firefox, Safari, or Edge.';
box.appendChild(h);
box.appendChild(p);
document.body.appendChild(box);
