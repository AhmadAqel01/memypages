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

// #region
const selectors_to_add = []
const SELECTORS_TO_BE_REMOVED  = ["a.abstract_t",".ack",".acknowledgment",".acknowledgments","[class*=\"ad\"]","[class*=\"ads\"]","a.medical_review","[class*=\"around-the-web\"]","[class*=ArticleAudio_promo]","[class*=ArticleBooksModule]","article.image-article","[class*=\"ArticleLegacyHtml_standard\"]","#article-references","[class*=\"ArticleRelatedContentModule\"]",".article-section__references","[class*=\"aside\"]","aside","*[alt*='audio']","*[class*='audio']","*[data-*='audio']","*[href*='audio']","*[id*='audio']","*[name*='audio']","*[src*='audio']","*[title*='audio']","[class*=\"author\"]","[data-article-section-title=\"Author Affiliations\"]","[data-article-section-title=\"Author Information\"]",".authorSectionElem","[class*=\"badges_sponsored\"]",".bibLink",".bibr","p.shortcode-media a[target=\"_blank\"]","a.rm-stats-tracked[target=\"_blank\"][href*=\"canva.com\"]","a.rm-stats-tracked[target=\"_blank\"][href*=\"flickr.com\"]","a.rm-stats-tracked[target=\"_blank\"][href*=\"giphy.com\"]","blockquote","blockquote.tiktok_lazy_shortcode","[class*=\"boost\"]","button.j-inline-reference",".c-ckc-acknowledgments",".c-ckc-bibliography",".c-ckc-further-reading"," [class*=\"citation\" i]","[ck-no-html-print]","[class*=\"clearfix\"]","#closeMessage","[class*=\"col\"]","[class*=\"comments\"]",".core-table-tools","[class*=\"core-table-tools\"]","[data-block]","[data-format]","[data-re-calc-image-with]","[data-rm-shortcode-id]","[data-section-id]","[data-source]","[class*=\"date\"]","[class*=Disclaimer]","div.collapse-sideways-arrow","div.headingAnchor","div.no-lazy","div.posts-custom","div.posts-custom-section","div.posts-wrapper","div.row","div.section-holder","div.share-tab-img.share-buttons.share-trigger","div.sponsor-proc","div.star-rating__container","div#topic-toolbar","div.widget__body > *:first-child","div.x-fixed-bar","[class*=\"dropBlock__holder\"]","[class*=\"dropBlock\" i]","[elid]","[class*=\"email\"]","[class*=\"embed\"]",".fig-orig","figure>.inline-image-caption","[class*=\"figure__open__ctrl\"]","[class*=\"follow\"]","[class*=\"footer\"]","footer",".footnote",".footnote-backref",".footnote-ref","[class*=\"form\"]","[class*=\"form\"] > label","[class*=\"from-your-site\"]","[data-article-section-title='Funding and Disclosures']",".grecaptcha-badge","head","header",".headingEndMark",".hide",".icon-expand","[class*=\"icon-full-screen\"]","iframe","[src=\"img/camera.svg\"]","[class*=\"infinite\"]",".inline-icon",".inline-image-caption:not(:is(.caption-holder *))",".inline-table-caption:has(a)",".inline-table-caption:has(i)","isDesktop.utdWkHeader.topicView",".isDesktop.utdWkHeader.topicView#topicContainer#topicOutline",".j-inline-reference ~ sup,.j-inline-reference",".js-expandable",".js-update-url","label.accesibility-hidden",".lazy-loadable",".letterdrop-custom-embed","[class^=\"licensing\"]","[class*=\"like\"]","link",".list-item-label","[data-once-text=\"Messages.content_loading_error\"]","[class*=\"meta\"]","meta","[class*=\"most-popular-post\"]",".MuiLink-underlineHover","[class*=\"nav\"]","nav","[class*=\"newsletter\"]",".ng-hide","[rel=\"noopener noreferrer\"]","noscript",".overflowTopicDropdown","[class*=\"page_views\"]","div[data-attr-from_regular_sections_other_than*=\"partner\"]","div[data-attr-source_id*=\"partner\"]",".paywall","[class*=\"photo-caption\"]","[class*=\"photo-credit\"]","[class*=\"post_shares\"]","link[rel=\"preload\"]","p.shortcode-media","p.shortcode-media-youtube","[class*=\"px10\"]","[class*=\"rebelmouse\"]","img[data-rm-shortcode-name=\"rebelmouse-image\"]","iframe[src*=\"reddit.com\"]",".reference","[data-type='Reference']"," [class*=\"reference-citations\"]",".reference-citations","#reference-list",".references",".References","#references","#ref-list-a.h.b","[class*=Related]","review","[class*=\"rm-col-center\"]",".rm-lazyloadable-image",".rm-stats-tracked",".screenreader-text","script","section.c-ckc-bibliography","section#sec-12","section#sec-13","[class*=\"share\"]","[class*=\"shortcode\"]","[data-behavior='ShowPopupTip']","[class*=\"signup\"]","#slaMessageContainer","[class*=\"sm-mt\"]","[class*=\"social\"]","span.animate-\\[show_150ms_ease-in\\].top-\\[-0\\.094rem\\].relative.items-center.max-w-full.inline-flex.ms-1","[class*=\"sponsor\"]","div[id^=\"sStream_\"]","div.text-element[id*=\"sStream_\"][id*=\"newsletter\"]","[id^=\"sStream_with_Partner_Boost\"]","[class*=\"stats\"]","style","sup:has(a.ejp-citation-link)","div.widget[class*=\"tag-\"]","[class*=\"tags\"]","[class*=\"text-element\"]","iframe[src*=\"tiktok.com\"]","#tipsAndLinks","title","#topicAgreement","topicContainer","#topicContributors","#topicOutline","topic-toolbar","#topicVersionRevision",".tsec.sec","iframe[src*=\"twitter.com\"]","#ui-ncbiinpagenav-1>div.fm-sec.half_rhythm.no_top_margin","[class^='updateInfoContainer']","#utd-main>utd-bridge-topic-view>div>div.topic-section-pointer.wkce-icon-arrow-right.topic-section-pointer-animate-in","[class*=\"video\"]","*[alt*='video']","*[class*='video']","*[data-*='video']","*[href*='video']","*[id*='video']","*[name*='video']","*[src*='video']","*[title*='video']",".visuallyhidden","[class*=\"widget\"]",".x-outline-menu",".x-outline-menu-button",".xref-bibr","a.rm-stats-tracked[href*=\"youtu.be\"]","a.rm-stats-tracked[href*=\"youtube.com\"]","iframe[src*=\"youtube.com\"]"]
/* Output as one css selector:
a.abstract_t, .ack, .acknowledgment, .acknowledgments, [class*="ad"], [class*="ads"], a.medical_review, [class*="around-the-web"], [class*=ArticleAudio_promo], [class*=ArticleBooksModule], article.image-article, [class*="ArticleLegacyHtml_standard"], #article-references, [class*="ArticleRelatedContentModule"], .article-section__references, [class*="aside"], aside, *[alt*='audio'], *[class*='audio'], *[data-*='audio'], *[href*='audio'], *[id*='audio'], *[name*='audio'], *[src*='audio'], *[title*='audio'], [class*="author"], [data-article-section-title="Author Affiliations"], [data-article-section-title="Author Information"], .authorSectionElem, [class*="badges_sponsored"], .bibLink, .bibr, p.shortcode-media a[target="_blank"], a.rm-stats-tracked[target="_blank"][href*="canva.com"], a.rm-stats-tracked[target="_blank"][href*="flickr.com"], a.rm-stats-tracked[target="_blank"][href*="giphy.com"], blockquote, blockquote.tiktok_lazy_shortcode, [class*="boost"], button.j-inline-reference, .c-ckc-acknowledgments, .c-ckc-bibliography, .c-ckc-further-reading,  [class*="citation" i], [ck-no-html-print], [class*="clearfix"], #closeMessage, [class*="col"], [class*="comments"], .core-table-tools, [class*="core-table-tools"], [data-block], [data-format], [data-re-calc-image-with], [data-rm-shortcode-id], [data-section-id], [data-source], [class*="date"], [class*=Disclaimer], div.collapse-sideways-arrow, div.headingAnchor, div.no-lazy, div.posts-custom, div.posts-custom-section, div.posts-wrapper, div.row, div.section-holder, div.share-tab-img.share-buttons.share-trigger, div.sponsor-proc, div.star-rating__container, div#topic-toolbar, div.widget__body > *:first-child, div.x-fixed-bar, [class*="dropBlock__holder"], [class*="dropBlock" i], [elid], [class*="email"], [class*="embed"], .fig-orig, figure>.inline-image-caption, [class*="figure__open__ctrl"], [class*="follow"], [class*="footer"], footer, .footnote, .footnote-backref, .footnote-ref, [class*="form"], [class*="form"] > label, [class*="from-your-site"], [data-article-section-title='Funding and Disclosures'], .grecaptcha-badge, head, header, .headingEndMark, .hide, .icon-expand, [class*="icon-full-screen"], iframe, [src="img/camera.svg"], [class*="infinite"], .inline-icon, .inline-image-caption:not(:is(.caption-holder *)), .inline-table-caption:has(a), .inline-table-caption:has(i), isDesktop.utdWkHeader.topicView, .isDesktop.utdWkHeader.topicView#topicContainer#topicOutline, .j-inline-reference ~ sup,.j-inline-reference, .js-expandable, .js-update-url, label.accesibility-hidden, .lazy-loadable, .letterdrop-custom-embed, [class^="licensing"], [class*="like"], link, .list-item-label, [data-once-text="Messages.content_loading_error"], [class*="meta"], meta, [class*="most-popular-post"], .MuiLink-underlineHover, [class*="nav"], nav, [class*="newsletter"], .ng-hide, [rel="noopener noreferrer"], noscript, .overflowTopicDropdown, [class*="page_views"], div[data-attr-from_regular_sections_other_than*="partner"], div[data-attr-source_id*="partner"], .paywall, [class*="photo-caption"], [class*="photo-credit"], [class*="post_shares"], link[rel="preload"], p.shortcode-media, p.shortcode-media-youtube, [class*="px10"], [class*="rebelmouse"], img[data-rm-shortcode-name="rebelmouse-image"], iframe[src*="reddit.com"], .reference, [data-type='Reference'],  [class*="reference-citations"], .reference-citations, #reference-list, .references, .References, #references, #ref-list-a.h.b, [class*=Related], review, [class*="rm-col-center"], .rm-lazyloadable-image, .rm-stats-tracked, .screenreader-text, script, section.c-ckc-bibliography, section#sec-12, section#sec-13, [class*="share"], [class*="shortcode"], [data-behavior='ShowPopupTip'], [class*="signup"], #slaMessageContainer, [class*="sm-mt"], [class*="social"], span.animate-\[show_150ms_ease-in\].top-\[-0\.094rem\].relative.items-center.max-w-full.inline-flex.ms-1, [class*="sponsor"], div[id^="sStream_"], div.text-element[id*="sStream_"][id*="newsletter"], [id^="sStream_with_Partner_Boost"], [class*="stats"], style, sup:has(a.ejp-citation-link), div.widget[class*="tag-"], [class*="tags"], [class*="text-element"], iframe[src*="tiktok.com"], #tipsAndLinks, title, #topicAgreement, topicContainer, #topicContributors, #topicOutline, topic-toolbar, #topicVersionRevision, .tsec.sec, iframe[src*="twitter.com"], #ui-ncbiinpagenav-1>div.fm-sec.half_rhythm.no_top_margin, [class^='updateInfoContainer'], #utd-main>utd-bridge-topic-view>div>div.topic-section-pointer.wkce-icon-arrow-right.topic-section-pointer-animate-in, [class*="video"], *[alt*='video'], *[class*='video'], *[data-*='video'], *[href*='video'], *[id*='video'], *[name*='video'], *[src*='video'], *[title*='video'], .visuallyhidden, [class*="widget"], .x-outline-menu, .x-outline-menu-button, .xref-bibr, a.rm-stats-tracked[href*="youtu.be"], a.rm-stats-tracked[href*="youtube.com"], iframe[src*="youtube.com"]
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
merged_selectors = mergeUniqueStrings(SELECTORS_TO_BE_REMOVED ,selectors_to_add)
const sorted_selectors = sortStringsAdvanced([...merged_selectors]);

const final_output = `const selectors_to_add = []
const SELECTORS_TO_BE_REMOVED  = ${JSON.stringify(sorted_selectors)}
/* Output as one css selector:
${sorted_selectors.join(', ')}

*/`

copy(final_output)
