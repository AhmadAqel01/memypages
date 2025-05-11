
const selectors_to_add = []
const selectors_to_remove = ["a.abstract_t",".ack",".acknowledgment",".acknowledgments","*[alt*='audio']","*[alt*='video']","a.medical_review","#article-references",".article-section__references","aside",".authorSectionElem",".bibLink",".bibr","button.j-inline-reference","button.j-inline-reference",".c-ckc-acknowledgments",".c-ckc-further-reading","[ck-no-html-print]","[class*=\"ads\"]","[class*=\"aside\"]","*[class*='audio']","[class*=\"footer\"]","[class^=\"licensing\"]","[class*=\"nav\"]","[class^='updateInfoContainer']","[class*=\"video\"]","*[class*='video']","#closeMessage","[data-article-section-title=\"Author Affiliations\"]","[data-article-section-title=\"Author Information\"]","[data-article-section-title='Funding and Disclosures']","*[data-*='audio']","[data-behavior='ShowPopupTip']","[data-once-text=\"Messages.content_loading_error\"]","[data-type='Reference']","*[data-*='video']","div.collapse-sideways-arrow","div.headingAnchor","div.star-rating__container","div#topic-toolbar","div.x-fixed-bar",".fig-orig","figure>.inline-image-caption","footer",".footnote",".footnote-backref",".footnote-ref",".grecaptcha-badge","header",".headingEndMark",".hide","*[href*='audio']","*[href*='video']",".icon-expand","*[id*='audio']","*[id*='video']",".inline-icon",".inline-image-caption:not(:is(.caption-holder *))",".inline-table-caption:has(a)",".inline-table-caption:has(i)","isDesktop.utdWkHeader.topicView",".isDesktop.utdWkHeader.topicView#topicContainer#topicOutline",".letterdrop-custom-embed","link",".list-item-label",".MuiLink-underlineHover","*[name*='audio']","*[name*='video']","nav",".ng-hide",".overflowTopicDropdown",".paywall",".reference",".reference-citations","#reference-list",".references",".References","#references","#ref-list-a.h.b","[rel=\"noopener noreferrer\"]","review",".screenreader-text","script","section.c-ckc-bibliography","section.c-ckc-bibliography","#slaMessageContainer","*[src*='audio']","*[src*='video']","style","sup:has(a.ejp-citation-link)","#tipsAndLinks","*[title*='audio']","*[title*='video']","#topicAgreement","topicContainer","#topicContributors","#topicContributors","#topicOutline","topic-toolbar","#topicVersionRevision",".tsec.sec","#ui-ncbiinpagenav-1>div.fm-sec.half_rhythm.no_top_margin","#utd-main>utd-bridge-topic-view>div>div.topic-section-pointer.wkce-icon-arrow-right.topic-section-pointer-animate-in",".visuallyhidden",".x-outline-menu",".x-outline-menu-button",".xref-bibr"]

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

const sorted_selectors = sortStringsAdvanced([...current_selectors_to_remove]);

const final_output = `const selectors_to_add = []
const selectors_to_remove = ${JSON.stringify(sorted_selectors)}
\**\
`

copy(final_output)
