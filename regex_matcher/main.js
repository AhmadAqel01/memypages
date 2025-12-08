document.addEventListener('DOMContentLoaded', () => {
  // check if patterns.json exist in the directory. If defined, return the value of the json file as default_patterns.
   fetch('patterns.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (Array.isArray(data)) {
            default_patterns = data.map(item => ({
                id: item.id || Date.now() + Math.random(),
                regex_pattern: item.regex_pattern || '',  
                flags: item.flags || 'g',
                replacement: item.replacement || '',
                description: item.description || ''
            }));
        } else {
            console.error('Invalid JSON format: Expected an array of pattern objects.');
        }
    })
    .catch(error => {
        console.error('Error fetching patterns.json:', error);
    });

  
  // State
    const state = {
        sourceText: '',
        processedText: '',
        docTitle: 'Untitled',
        patterns: default_patterns || [
            { id: Date.now(), regex_pattern: '', flags: 'g', replacement: '', description: '' }
        ],
        fileHandle: null // For File System Access API
    };

    // DOM Elements
    const sourceTextInput = document.getElementById('source-text');
    const addPatternBtn = document.getElementById('add-pattern-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const patternsList = document.getElementById('patterns-list');
    const processedTextDisplay = document.getElementById('processed-text');
    const matchesListDisplay = document.getElementById('matches-list');
    const docTitleInput = document.getElementById('doc-title');

    // Feature Controls
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const exportBtn = document.getElementById('export-btn');
    const saveAsBtn = document.getElementById('save-as-btn');
    const importTextBtn = document.getElementById('import-text-btn');
    const importTextFile = document.getElementById('import-text-file');
    const saveOutputBtn = document.getElementById('save-output-btn');
    const copyBtn = document.getElementById('copy-btn');
    const previewBtn = document.getElementById('preview-btn');

    // Initial Render
    renderPatterns();
    updateOutput();

    // Event Listeners
    sourceTextInput.addEventListener('input', (e) => {
        state.sourceText = e.target.value;
        updateTitleFromContentIfNeeded();
        updateOutput();
    });

    if (docTitleInput) {
        docTitleInput.addEventListener('input', (e) => {
            state.docTitle = e.target.value;
        });
    }

    addPatternBtn.addEventListener('click', () => {
        state.patterns.push({
            id: Date.now(),
            regex_pattern: '',
            flags: 'g',
            replacement: '',
            description: ''
        });
        renderPatterns();
        triggerAutoSave();

        // Auto-scroll to bottom of list
        const entries = patternsList.querySelectorAll('.pattern-entry');
        if (entries.length > 0) {
            entries[entries.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all patterns?')) {
                state.patterns = [];
                state.fileHandle = null; // Unlink file on clear
                renderPatterns();
                updateOutput();
                saveAsBtn.style.color = ''; // Reset color
            }
        });
    }

    // Import Patterns
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (Array.isArray(json)) {
                    state.patterns = json.map(item => ({
                        id: item.id || Date.now() + Math.random(),
                        regex_pattern: item.regex_pattern || '',
                        flags: item.flags || 'g',
                        replacement: item.replacement || '',
                        description: item.description || ''
                    }));
                    renderPatterns();
                    updateOutput();
                    triggerAutoSave();
                } else {
                    alert('Invalid JSON format: Expected an array of pattern objects.');
                }
            } catch (err) {
                alert('Error parsing JSON file.');
                console.error(err);
            }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    // Export Patterns
    exportBtn.addEventListener('click', () => {
        const safeTitle = state.docTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.patterns, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `regex_patterns_${safeTitle}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Auto-Save Setup
    saveAsBtn.addEventListener('click', async () => {
        if ('showSaveFilePicker' in window) {
            try {
                const safeTitle = state.docTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const handle = await window.showSaveFilePicker({
                    suggestedName: `patterns_${safeTitle}.json`,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                state.fileHandle = handle;
                await saveToFile();
                alert('Auto-save enabled for this file.');
                saveAsBtn.style.color = 'var(--success-color)';
            } catch (err) {
                console.log('Save setup cancelled', err);
            }
        } else {
            alert('Your browser does not support the File System Access API. Auto-save is not available.');
        }
    });

    // Import Source Text
    importTextBtn.addEventListener('click', () => importTextFile.click());
    importTextFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Set title from filename
        const filename = file.name.replace(/\.[^/.]+$/, ""); // strip ext
        state.docTitle = filename;
        if (docTitleInput) docTitleInput.value = filename;

        const reader = new FileReader();
        reader.onload = (event) => {
            state.sourceText = event.target.result;
            sourceTextInput.value = state.sourceText;
            updateOutput();
        };
        reader.readAsText(file);
        importTextFile.value = '';
    });

    // Save Output MD
    saveOutputBtn.addEventListener('click', () => {
        const content = state.processedText;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", `${state.docTitle.replace(/[^a-z0-9]/gi, '_')}.md`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
    });

    // Copy to Clipboard
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!state.processedText) return;
            navigator.clipboard.writeText(state.processedText).then(() => {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span style="font-size: 0.75rem;">Copied!</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        });
    }

    // Preview HTML
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            if (!state.processedText) return;
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Preview: ${state.docTitle}</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
                            h1, h2, h3 { color: #111; }
                            pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
                            code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace; }
                            blockquote { border-left: 4px solid #ddd; padding-left: 1rem; color: #666; margin-left: 0; }
                            img { max-width: 100%; }
                            a { color: #0366d6; }
                            table { border-collapse: collapse; width: 100%; }
                            th, td { border: 1px solid #ddd; padding: 8px; }
                            th { background-color: #f2f2f2; }
                        </style>
                    </head>
                    <body>
                        ${window.marked ? window.marked.parse(state.processedText) : '<p>Error: marked library not active.</p>' + state.processedText.replace(/\n/g, '<br>')}
                    </body>
                    </html>
                `);
                newWindow.document.close();
            }
        });
    }

    let autoSaveTimeout;
    function triggerAutoSave() {
        if (!state.fileHandle) return;

        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveToFile();
        }, 1000);
    }

    async function saveToFile() {
        if (!state.fileHandle) return;
        try {
            const writable = await state.fileHandle.createWritable();
            await writable.write(JSON.stringify(state.patterns, null, 2));
            await writable.close();
            console.log('Auto-saved to file.');
        } catch (err) {
            console.error('Auto-save failed:', err);
        }
    }

    function updateTitleFromContentIfNeeded() {
        // If title is default "Untitled", try to guess from content
        // Criteria: Markdown header or first short line
        if (state.docTitle !== 'Untitled' && state.docTitle !== '') return;

        const text = state.sourceText.trim();
        if (!text) return;

        const headerMatch = text.match(/^#\s+(.+)$/m);
        if (headerMatch) {
            state.docTitle = headerMatch[1].trim();
        } else {
            const firstLine = text.split('\n')[0].trim();
            if (firstLine.split(/\s+/).length < 7 && firstLine.length > 0) {
                state.docTitle = firstLine;
            }
        }
        if (docTitleInput) docTitleInput.value = state.docTitle;
    }


    // Core Logic
    function updateOutput() {
        let processed = state.sourceText;

        state.patterns.forEach(p => {
            if (!p.regex_pattern) return;

            try {
                const regex = new RegExp(p.regex_pattern, p.flags || 'g');
                processed = processed.replace(regex, p.replacement);
            } catch (e) {
                // Invalid regex
            }
        });

        state.processedText = processed;
        processedTextDisplay.textContent = processed;
        recalculateStatsAndRender();
        triggerAutoSave();
    }

    function recalculateStatsAndRender() {
        const stats = [];

        state.patterns.forEach(p => {
            if (!p.regex_pattern) return;
            try {
                const regex = new RegExp(p.regex_pattern, p.flags || 'g');
                const matches = [];
                if (regex.global) {
                    const m = state.sourceText.match(regex);
                    if (m) matches.push(...m);
                } else {
                    const m = state.sourceText.match(regex);
                    if (m) matches.push(m[0]);
                }

                if (matches.length > 0) {
                    stats.push({
                        id: p.id,
                        regex: p.regex_pattern,
                        count: matches.length,
                        items: matches,
                        description: p.description
                    });
                }
            } catch (e) { /* ignore */ }
        });

        stats.sort((a, b) => b.count - a.count);
        renderStats(stats);
    }

    // Render Functions
    function renderPatterns() {
        patternsList.innerHTML = '';
        state.patterns.forEach((p, index) => {
            const el = document.createElement('div');
            el.className = 'pattern-entry';
            el.innerHTML = `
                <div class="pattern-entry-header">
                    <span class="pattern-label">Pattern #${index + 1}</span>
                    <button class="btn-icon btn-delete" data-id="${p.id}" title="Remove Pattern">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div class="pattern-main-row">
                    <input type="text" class="regex-input" value="${escapeHtmlAttribute(p.regex_pattern)}" placeholder="RegEx" data-id="${p.id}">
                    <input type="text" class="flag-input" value="${escapeHtmlAttribute(p.flags)}" placeholder="Flags" data-id="${p.id}" title="Flags (e.g. g, i, m)">
                    <input type="text" class="replace-input" value="${escapeHtmlAttribute(p.replacement)}" placeholder="Replacement" data-id="${p.id}">
                </div>
                <div class="pattern-desc-row">
                     <textarea class="description-input" placeholder="Description of this pattern..." data-id="${p.id}">${p.description || ''}</textarea>
                </div>
            `;
            patternsList.appendChild(el);
        });

        // Re-attach listeners
        attachInputListener('.regex-input', 'regex_pattern');
        attachInputListener('.flag-input', 'flags');
        attachInputListener('.replace-input', 'replacement');
        attachInputListener('.description-input', 'description');

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseFloat(e.currentTarget.dataset.id);
                state.patterns = state.patterns.filter(p => p.id !== id);
                renderPatterns();
                updateOutput();
                triggerAutoSave();
            });
        });
    }

    function attachInputListener(selector, field) {
        document.querySelectorAll(selector).forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseFloat(e.target.dataset.id);
                const pat = state.patterns.find(x => x.id === id);
                if (pat) {
                    pat[field] = e.target.value;
                    if (field !== 'description') {
                        updateOutput();
                    } else {
                        triggerAutoSave();
                    }
                }
            });
        });
    }

    function renderStats(stats) {
        matchesListDisplay.innerHTML = '';
        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'match-stat-card';

            const shownMatches = stat.items.slice(0, 100);
            const hasMore = stat.items.length > 100;
            const descHtml = stat.description ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">${escapeHtml(stat.description)}</div>` : '';

            card.innerHTML = `
                <div class="match-stat-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="match-info">
                        <svg class="match-toggle-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <div style="flex:1; overflow:hidden;">
                            <div>
                                <span class="match-regex-pattern" title="${stat.regex}">/${stat.regex}/</span>
                                <span class="match-count">(${stat.count})</span>
                            </div>
                            ${descHtml}
                        </div>
                    </div>
                </div>
                <div class="match-details">
                    ${shownMatches.map(m => `<div class="match-item">${escapeHtml(m)}</div>`).join('')}
                    ${hasMore ? `<div class="match-item" style="font-style:italic">...and ${stat.items.length - 100} more</div>` : ''}
                </div>
            `;
            matchesListDisplay.appendChild(card);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function escapeHtmlAttribute(text) {
        if (!text) return '';
        return text.replace(/"/g, '&quot;');
    }
});
