/* The Workflow:
1. Obtain the new selectors you want to add (to get selectors from uBlock filter list, call 
```
copy(`const selectors_to_add = ${JSON.stringify($$('.cm-variable').map(e=>e.innerText))}`)
```
2. update the empty selectors_to_add 
3. execute this script.
4. Replace the region below with final output written to the clipboard.
)
*/

//#region To update content, replace this section:
const selectors_to_add = []
const current_selectors_to_remove = ["a.abstract_t",".ack",".acknowledgment",".acknowledgments","[class*=\"ads\"]","a.medical_review","#article-references",".article-section__references","[class*=\"aside\"]","aside","*[alt*='audio']","*[class*='audio']","*[data-*='audio']","*[href*='audio']","*[id*='audio']","*[name*='audio']","*[src*='audio']","*[title*='audio']","[data-article-section-title=\"Author Affiliations\"]","[data-article-section-title=\"Author Information\"]",".authorSectionElem",".bibLink",".bibr","button.j-inline-reference","button.j-inline-reference",".c-ckc-acknowledgments",".c-ckc-further-reading","[ck-no-html-print]","#closeMessage","div.collapse-sideways-arrow","div.headingAnchor","div.star-rating__container","div#topic-toolbar","div.x-fixed-bar",".fig-orig","figure>.inline-image-caption","[class*=\"footer\"]","footer",".footnote",".footnote-backref",".footnote-ref","[data-article-section-title='Funding and Disclosures']",".grecaptcha-badge","header",".headingEndMark",".hide",".icon-expand",".inline-icon",".inline-image-caption:not(:is(.caption-holder *))",".inline-table-caption:has(a)",".inline-table-caption:has(i)","isDesktop.utdWkHeader.topicView",".isDesktop.utdWkHeader.topicView#topicContainer#topicOutline",".letterdrop-custom-embed","[class^=\"licensing\"]","link",".list-item-label","[data-once-text=\"Messages.content_loading_error\"]",".MuiLink-underlineHover","[class*=\"nav\"]","nav",".ng-hide","[rel=\"noopener noreferrer\"]",".overflowTopicDropdown",".paywall",".reference","[data-type='Reference']",".reference-citations","#reference-list",".references",".References","#references","#ref-list-a.h.b","review",".screenreader-text","script","section.c-ckc-bibliography","section.c-ckc-bibliography","[data-behavior='ShowPopupTip']","#slaMessageContainer","style","sup:has(a.ejp-citation-link)","#tipsAndLinks","#topicAgreement","topicContainer","#topicContributors","#topicContributors","#topicOutline","topic-toolbar","#topicVersionRevision",".tsec.sec","#ui-ncbiinpagenav-1>div.fm-sec.half_rhythm.no_top_margin","[class^='updateInfoContainer']","#utd-main>utd-bridge-topic-view>div>div.topic-section-pointer.wkce-icon-arrow-right.topic-section-pointer-animate-in","[class*=\"video\"]","*[alt*='video']","*[class*='video']","*[data-*='video']","*[href*='video']","*[id*='video']","*[name*='video']","*[src*='video']","*[title*='video']",".visuallyhidden",".x-outline-menu",".x-outline-menu-button",".xref-bibr"]
/* Output as one css selector:
a.abstract_t, .ack, .acknowledgment, .acknowledgments, [class*="ads"], a.medical_review, #article-references, .article-section__references, [class*="aside"], aside, *[alt*='audio'], *[class*='audio'], *[data-*='audio'], *[href*='audio'], *[id*='audio'], *[name*='audio'], *[src*='audio'], *[title*='audio'], [data-article-section-title="Author Affiliations"], [data-article-section-title="Author Information"], .authorSectionElem, .bibLink, .bibr, button.j-inline-reference, button.j-inline-reference, .c-ckc-acknowledgments, .c-ckc-further-reading, [ck-no-html-print], #closeMessage, div.collapse-sideways-arrow, div.headingAnchor, div.star-rating__container, div#topic-toolbar, div.x-fixed-bar, .fig-orig, figure>.inline-image-caption, [class*="footer"], footer, .footnote, .footnote-backref, .footnote-ref, [data-article-section-title='Funding and Disclosures'], .grecaptcha-badge, header, .headingEndMark, .hide, .icon-expand, .inline-icon, .inline-image-caption:not(:is(.caption-holder *)), .inline-table-caption:has(a), .inline-table-caption:has(i), isDesktop.utdWkHeader.topicView, .isDesktop.utdWkHeader.topicView#topicContainer#topicOutline, .letterdrop-custom-embed, [class^="licensing"], link, .list-item-label, [data-once-text="Messages.content_loading_error"], .MuiLink-underlineHover, [class*="nav"], nav, .ng-hide, [rel="noopener noreferrer"], .overflowTopicDropdown, .paywall, .reference, [data-type='Reference'], .reference-citations, #reference-list, .references, .References, #references, #ref-list-a.h.b, review, .screenreader-text, script, section.c-ckc-bibliography, section.c-ckc-bibliography, [data-behavior='ShowPopupTip'], #slaMessageContainer, style, sup:has(a.ejp-citation-link), #tipsAndLinks, #topicAgreement, topicContainer, #topicContributors, #topicContributors, #topicOutline, topic-toolbar, #topicVersionRevision, .tsec.sec, #ui-ncbiinpagenav-1>div.fm-sec.half_rhythm.no_top_margin, [class^='updateInfoContainer'], #utd-main>utd-bridge-topic-view>div>div.topic-section-pointer.wkce-icon-arrow-right.topic-section-pointer-animate-in, [class*="video"], *[alt*='video'], *[class*='video'], *[data-*='video'], *[href*='video'], *[id*='video'], *[name*='video'], *[src*='video'], *[title*='video'], .visuallyhidden, .x-outline-menu, .x-outline-menu-button, .xref-bibr
*/
//#endregion

function mergeUniqueStrings(arr1, arr2) {
  // Spread both arrays into a new Set to automatically handle duplicates,
  // then spread the Set back into an array.
  return [...new Set([...arr1, ...arr2])];
}

function sortStringsAdvanced(stringArray) {
  // Helper function to determine the primary sorting key for a string
  const getProcessedKey = (str) => {
    // Inner helper to sanitize a string: keep only a-z, lowercase
    const sanitize = (s) => s.replace(/[^a-z]/gi, "").toLowerCase();

    const equalSignIndex = str.indexOf('=');

    if (equalSignIndex !== -1) {
      // If '=' exists, use the part to the right of the first '='
      const rhs = str.substring(equalSignIndex + 1);
      return sanitize(rhs);
    } else {
      // Otherwise, use the whole string
      return sanitize(str);
    }
  };

  // Sort the array in-place
  stringArray.sort((a, b) => {
    const keyA = getProcessedKey(a);
    const keyB = getProcessedKey(b);

    // Primary sort: Compare the processed keys
    if (keyA < keyB) {
      return -1;
    }
    if (keyA > keyB) {
      return 1;
    }

    // Secondary sort (fallback): If processed keys are the same,
    // compare the original strings using localeCompare for proper string sorting.
    return a.localeCompare(b);
  });

  return stringArray; // Return the sorted array (though it's sorted in-place)
}
merged_selectors = mergeUniqueStrings(current_selectors_to_remove,selectors_to_add)
const sorted_selectors = sortStringsAdvanced([...merged_selectors]);

const final_output = `const selectors_to_add = []
const current_selectors_to_remove = ${JSON.stringify(sorted_selectors)}
/* Output as one css selector:
${sorted_selectors.join(', ')}

*/`

copy(final_output)
