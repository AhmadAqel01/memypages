// Cache frequently accessed DOM elements
const inputArea = document.getElementById("inputArea");
const outputArea = document.getElementById("outputArea");
const tagContainer = document.getElementById("tagCheckboxes");

function getParsedHTML() {
  const inputHTML = inputArea.value;
  const parser = new DOMParser();
  return parser.parseFromString(inputHTML, "text/html");
}

inputArea.addEventListener("input", processHTML);

document.getElementById("pasteBtn").addEventListener("click", function () {
  navigator.clipboard
    .readText()
    .then((clipText) => {
      inputArea.value = clipText;
      processHTML();
    })
    .catch((error) => {
      console.error("Error reading clipboard:", error);
    });
});

// TODO: Implement this when you have file input handling in place
document.getElementById("importBtn").addEventListener("click", function () {
  processHTML();
});

function processHTML() {
  const doc = getParsedHTML();
  const tags = {};

  doc.body.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    tags[tag] = (tags[tag] || 0) + 1;
  });

  // Create checkboxes sorted alphabetically
  const fragment = document.createDocumentFragment();
  Object.keys(tags)
    .sort()
    .forEach((tag) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tag;
      const tagText = document.createTextNode(`${tag} (${tags[tag]})`);
      tagText.addEventListener("click", function () {
        alert(`Tag: ${tag}\nFrequency: ${tags[tag]}`);
      });
      label.appendChild(checkbox);
      label.appendChild(tagText);
      fragment.appendChild(label);
    });

  tagContainer.innerHTML = "";
  tagContainer.appendChild(fragment);
}

document.getElementById("extractBtn").addEventListener("click", function () {
  const doc = getParsedHTML();
  const action = document.getElementById("action").value;
  const displayType = document.getElementById("displayType").value;
  const addDivider = document.getElementById("addDividerCheckbox").checked;
  const checkedTags = [...tagContainer.querySelectorAll("input:checked")].map(
    (input) => input.value
  );

  let output = "";

  if (action === "remove") {
    checkedTags.forEach((tag) => {
      doc.body.querySelectorAll(tag).forEach((el) => {
        el.remove();
      });
    });

    if (displayType === "textContent") {
      output = doc.body.textContent.trim();
      if (addDivider) {
        output = output.split("\n").join("\n------------------\n");
      }
    } else {
      output = doc.body.innerHTML.trim();
      if (addDivider) {
        output = insertDividersBetweenElements(doc);
      }
    }
  } else if (action === "show") {
    const selectedEls = [];
    checkedTags.forEach((tag) => {
      const els = Array.from(doc.body.querySelectorAll(tag));
      selectedEls.push(...els);
    });

    selectedEls.forEach((el) => {
      if (displayType === "textContent") {
        output += el.textContent + "\n";
      } else {
        output += el.outerHTML + "\n";
      }
      if (addDivider) output += "<hr>";
    });
  }

  outputArea.value = output;
});

function insertDividersBetweenElements(doc) {
  const allEls = Array.from(doc.body.children);
  let result = "";
  allEls.forEach((el, index) => {
    result += el.outerHTML;
    if (index !== allEls.length - 1) {
      result += "<hr>";
    }
  });
  return result;
}


document.getElementById("formatBtn").addEventListener("click", function () {
  const currentOutput = outputArea.value;
  const formattedOutput = formatHTML(currentOutput);
  outputArea.value = formattedOutput;
});

function formatHTML(html, addDivider) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (addDivider) {
    doc.body.querySelectorAll("*").forEach((el) => {
      if (el.nextSibling) {
        const hr = doc.createElement("hr");
        el.parentNode.insertBefore(hr, el.nextSibling);
      }
    });
  }

  return doc.body.innerHTML.trim();
}
