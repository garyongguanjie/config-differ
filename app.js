// ==================== UTILITY FUNCTIONS ====================

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ==================== LCS ALGORITHM FOR CHARACTER-LEVEL DIFF ====================

/**
 * Computes the Longest Common Subsequence matrix for two strings
 */
function computeLCS(str1, str2) {
    str1 = str1 || '';
    str2 = str2 || '';
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp;
}

/**
 * Highlights character-level differences between two strings
 * Returns objects with highlighted segments for left and right strings
 */
function highlightDifferences(str1, str2) {
    str1 = str1 || '';
    str2 = str2 || '';
    const dp = computeLCS(str1, str2);
    const left = [];
    const right = [];
    
    let i = str1.length;
    let j = str2.length;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && str1[i - 1] === str2[j - 1]) {
            left.unshift({ text: str1[i - 1], type: 'unchanged' });
            right.unshift({ text: str2[j - 1], type: 'unchanged' });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            right.unshift({ text: str2[j - 1], type: 'added' });
            j--;
        } else if (i > 0) {
            left.unshift({ text: str1[i - 1], type: 'removed' });
            i--;
        }
    }
    
    return { left, right };
}

// ==================== PROPERTY PARSER ====================

class PropertyParser {
    /**
     * Parses Spring Boot .properties file format
     * Returns array of entries with key, value, comment, and type
     */
    parse(text) {
        if (text == null) return [];
        const lines = String(text).split('\n');
        const entries = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Blank line
            if (trimmed === '') {
                entries.push({ type: 'blank', line: '' });
                i++;
                continue;
            }
            
            // Comment line
            if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
                entries.push({ type: 'comment', line: line });
                i++;
                continue;
            }
            
            // Property line
            const result = this.parsePropertyLine(line, lines, i);
            if (result) {
                entries.push({
                    type: 'property',
                    key: result.key,
                    value: result.value,
                    line: result.fullLine
                });
                i = result.nextIndex;
            } else {
                // Invalid line, treat as comment
                entries.push({ type: 'comment', line: line });
                i++;
            }
        }
        
        return entries;
    }
    
    /**
     * Parses a single property line, handling multi-line values
     */
    parsePropertyLine(line, allLines, startIndex) {
        let fullLine = line;
        let currentIndex = startIndex;
        
        // Handle line continuation with backslash
        while (fullLine.trimEnd().endsWith('\\') && currentIndex + 1 < allLines.length) {
            currentIndex++;
            fullLine = fullLine.trimEnd().slice(0, -1) + allLines[currentIndex];
        }
        
        // Find the separator (=, :, or space)
        const separatorMatch = fullLine.match(/^([^=:\s]+)\s*[:=]\s*(.*)$/);
        
        if (separatorMatch) {
            return {
                key: separatorMatch[1].trim(),
                value: separatorMatch[2].trim(),
                fullLine: fullLine,
                nextIndex: currentIndex + 1
            };
        }
        
        // Try space-separated format
        const spaceMatch = fullLine.match(/^(\S+)\s+(.+)$/);
        if (spaceMatch) {
            return {
                key: spaceMatch[1].trim(),
                value: spaceMatch[2].trim(),
                fullLine: fullLine,
                nextIndex: currentIndex + 1
            };
        }
        
        return null;
    }
    
    /**
     * Sorts entries by key, preserving comments with their associated properties
     */
    sort(entries) {
        if (!Array.isArray(entries)) return [];
        const result = [];
        const properties = [];
        let pendingComments = [];
        
        // Group properties with their preceding comments
        for (const entry of entries) {
            if (entry.type === 'comment') {
                pendingComments.push(entry);
            } else if (entry.type === 'property') {
                properties.push({
                    key: entry.key,
                    value: entry.value,
                    comments: [...pendingComments],
                    entry: entry
                });
                pendingComments = [];
            } else if (entry.type === 'blank') {
                pendingComments.push(entry);
            }
        }
        
        // Sort properties by key
        properties.sort((a, b) => a.key.localeCompare(b.key));
        
        // Reconstruct with comments
        for (const prop of properties) {
            result.push(...prop.comments);
            result.push(prop.entry);
        }
        
        // Add any trailing comments
        result.push(...pendingComments);
        
        return result;
    }
    
    /**
     * Converts entries back to properties format
     */
    stringify(entries) {
        if (!Array.isArray(entries)) return '';
        return entries.map(entry => {
            if (entry.type === 'property') {
                return `${entry.key}=${entry.value}`;
            } else if (entry.type === 'comment' || entry.type === 'blank') {
                return entry.line;
            }
            return '';
        }).join('\n');
    }
}

// ==================== YAML PARSER ====================

class YAMLParser {
    /**
     * Parses YAML text into a structured object with comments preserved
     */
    parse(text) {
        if (text == null) return {};
        const lines = String(text).split('\n');
        this.lines = lines;
        this.currentLine = 0;
        
        const result = this.parseLevel(0);
        return result;
    }
    
    /**
     * Recursively parses YAML at a specific indentation level
     */
    parseLevel(baseIndent) {
        const obj = {};
        let pendingComments = [];
        
        while (this.currentLine < this.lines.length) {
            const line = this.lines[this.currentLine];
            const trimmed = line.trim();
            
            // Skip blank lines
            if (trimmed === '') {
                this.currentLine++;
                continue;
            }
            
            // Capture comments
            if (trimmed.startsWith('#')) {
                pendingComments.push(trimmed);
                this.currentLine++;
                continue;
            }
            
            // Calculate indentation
            const indent = line.search(/\S/);
            if (indent === -1) {
                this.currentLine++;
                continue;
            }
            
            // If indentation is less than base, we've finished this level
            if (indent < baseIndent) {
                break;
            }
            
            // If indentation is greater than base, skip (will be handled by recursion)
            if (indent > baseIndent && baseIndent !== 0) {
                break;
            }
            
            // Parse key-value pair
            const keyValueMatch = trimmed.match(/^([^:#]+):\s*(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim();
                
                this.currentLine++;
                
                // Check if next line is more indented (nested object)
                if (this.currentLine < this.lines.length) {
                    const nextLine = this.lines[this.currentLine];
                    const nextIndent = nextLine.search(/\S/);
                    
                    if (nextIndent > indent && nextLine.trim() !== '') {
                        // Nested object
                        obj[key] = {
                            _value: this.parseLevel(nextIndent),
                            _comments: [...pendingComments]
                        };
                    } else if (value === '') {
                        // Empty value or object to be defined
                        obj[key] = {
                            _value: '',
                            _comments: [...pendingComments]
                        };
                    } else {
                        // Simple value
                        obj[key] = {
                            _value: value,
                            _comments: [...pendingComments]
                        };
                    }
                } else {
                    obj[key] = {
                        _value: value,
                        _comments: [...pendingComments]
                    };
                }
                
                pendingComments = [];
            } else if (trimmed.startsWith('-')) {
                // Array item - not fully implemented, treat as value
                const arrayValue = trimmed.substring(1).trim();
                obj[`_array_${this.currentLine}`] = {
                    _value: arrayValue,
                    _comments: [...pendingComments]
                };
                this.currentLine++;
                pendingComments = [];
            } else {
                this.currentLine++;
            }
        }
        
        return obj;
    }
    
    /**
     * Recursively sorts YAML object by keys
     */
    sortRecursively(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        
        const sorted = {};
        const keys = Object.keys(obj).sort();
        
        for (const key of keys) {
            const item = obj[key];
            if (item && typeof item === 'object' && '_value' in item) {
                // This is a YAML node with metadata
                if (typeof item._value === 'object' && item._value !== null) {
                    sorted[key] = {
                        _value: this.sortRecursively(item._value),
                        _comments: item._comments || []
                    };
                } else {
                    sorted[key] = item;
                }
            } else {
                sorted[key] = this.sortRecursively(item);
            }
        }
        
        return sorted;
    }
    
    /**
     * Converts YAML object back to string format
     */
    stringify(obj, indent = 0) {
        if (typeof obj !== 'object' || obj === null) {
            return String(obj);
        }
        
        const lines = [];
        const indentStr = '  '.repeat(indent);
        
        for (const key of Object.keys(obj)) {
            const item = obj[key];
            
            if (item && typeof item === 'object' && '_value' in item) {
                // Add comments
                if (item._comments && item._comments.length > 0) {
                    for (const comment of item._comments) {
                        lines.push(indentStr + comment);
                    }
                }
                
                // Add key-value
                if (typeof item._value === 'object' && item._value !== null && Object.keys(item._value).length > 0) {
                    lines.push(indentStr + key + ':');
                    lines.push(this.stringify(item._value, indent + 1));
                } else {
                    lines.push(indentStr + key + ': ' + item._value);
                }
            } else {
                lines.push(indentStr + key + ':');
                lines.push(this.stringify(item, indent + 1));
            }
        }
        
        return lines.join('\n');
    }
    
    /**
     * Flattens YAML object to key-value pairs for comparison
     */
    flatten(obj, prefix = '') {
        const result = [];
        
        if (typeof obj !== 'object' || obj === null) {
            return [{ key: prefix || '', value: obj != null ? String(obj) : '', comments: [] }];
        }
        
        for (const key of Object.keys(obj)) {
            const item = obj[key];
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (item == null) {
                result.push({ key: fullKey, value: '', comments: [] });
            } else if (typeof item === 'object' && '_value' in item) {
                if (typeof item._value === 'object' && item._value !== null && Object.keys(item._value).length > 0) {
                    result.push(...this.flatten(item._value, fullKey));
                } else {
                    result.push({
                        key: fullKey,
                        value: item._value != null ? String(item._value) : '',
                        comments: item._comments || []
                    });
                }
            } else if (typeof item === 'object') {
                result.push(...this.flatten(item, fullKey));
            } else {
                result.push({ key: fullKey, value: String(item), comments: [] });
            }
        }
        
        return result;
    }
}

// ==================== DIFF ENGINE ====================

class DiffEngine {
    /**
     * Compares two sets of config data and generates diff
     */
    compare(leftData, rightData, fileType) {
        if (leftData == null && rightData == null) return [];
        
        let leftEntries, rightEntries;
        
        if (fileType === 'properties') {
            leftEntries = this.propertiesToMap(leftData);
            rightEntries = this.propertiesToMap(rightData);
        } else {
            // YAML
            const parser = new YAMLParser();
            leftEntries = this.yamlToMap(parser.flatten(leftData));
            rightEntries = this.yamlToMap(parser.flatten(rightData));
        }
        
        // Get all unique keys
        const allKeys = new Set([...leftEntries.keys(), ...rightEntries.keys()]);
        const sortedKeys = Array.from(allKeys).sort();
        
        const diffResults = [];
        
        for (const key of sortedKeys) {
            const hasLeft = leftEntries.has(key);
            const hasRight = rightEntries.has(key);
            const leftValue = hasLeft ? leftEntries.get(key) : undefined;
            const rightValue = hasRight ? rightEntries.get(key) : undefined;
            
            if (!hasLeft && hasRight) {
                // Added
                diffResults.push({
                    status: 'added',
                    leftLine: '',
                    rightLine: this.formatLine(key, rightValue, fileType),
                    leftHighlight: null,
                    rightHighlight: null
                });
            } else if (hasLeft && !hasRight) {
                // Removed
                diffResults.push({
                    status: 'removed',
                    leftLine: this.formatLine(key, leftValue, fileType),
                    rightLine: '',
                    leftHighlight: null,
                    rightHighlight: null
                });
            } else if (leftValue !== rightValue) {
                // Modified
                const highlights = highlightDifferences(leftValue, rightValue);
                diffResults.push({
                    status: 'modified',
                    leftLine: this.formatLine(key, leftValue, fileType),
                    rightLine: this.formatLine(key, rightValue, fileType),
                    leftHighlight: highlights.left,
                    rightHighlight: highlights.right,
                    key: key,
                    fileType: fileType
                });
            } else {
                // Unchanged
                diffResults.push({
                    status: 'unchanged',
                    leftLine: this.formatLine(key, leftValue, fileType),
                    rightLine: this.formatLine(key, rightValue, fileType),
                    leftHighlight: null,
                    rightHighlight: null
                });
            }
        }
        
        return diffResults;
    }
    
    /**
     * Converts property entries to a Map of key->value
     */
    propertiesToMap(entries) {
        const map = new Map();
        if (!Array.isArray(entries)) return map;
        for (const entry of entries) {
            if (entry && entry.type === 'property') {
                map.set(entry.key || '', entry.value || '');
            }
        }
        return map;
    }
    
    /**
     * Converts YAML flat entries to a Map of key->value
     */
    yamlToMap(entries) {
        const map = new Map();
        if (!Array.isArray(entries)) return map;
        for (const entry of entries) {
            if (entry) {
                map.set(entry.key || '', entry.value || '');
            }
        }
        return map;
    }
    
    /**
     * Formats a key-value pair as a display line
     */
    formatLine(key, value, fileType) {
        const safeKey = key != null ? key : '';
        const safeValue = value != null ? value : '';
        if (fileType === 'properties') {
            return `${safeKey}=${safeValue}`;
        } else {
            return `${safeKey}: ${safeValue}`;
        }
    }
}

// ==================== DIFF RENDERER ====================

class DiffRenderer {
    /**
     * Renders the diff results as a GitHub-style side-by-side diff table.
     * Each row has: [left line#] [left indicator] [left content] [right line#] [right indicator] [right content]
     * Uses a hidden sync row to force both content cells to the same height when text wraps.
     */
    render(diffData, container) {
        if (!container) return;
        if (!Array.isArray(diffData) || diffData.length === 0) {
            container.innerHTML = '<p>No differences found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'diff-table';

        // colgroup enforces fixed column widths
        table.innerHTML = `<colgroup>
            <col class="col-indicator">
            <col class="col-content">
            <col class="col-indicator">
            <col class="col-content">
        </colgroup>`;

        for (const diff of diffData) {
            const row = document.createElement('tr');
            row.className = diff.status;

            if (diff.status === 'added') {
                row.innerHTML =
                    `<td class="indicator empty-cell"></td>` +
                    `<td class="diff-code empty-cell"></td>` +
                    `<td class="indicator indicator-added">+</td>` +
                    `<td class="diff-code diff-code-right">${escapeHtml(diff.rightLine)}</td>`;
            } else if (diff.status === 'removed') {
                row.innerHTML =
                    `<td class="indicator indicator-removed">-</td>` +
                    `<td class="diff-code diff-code-left">${escapeHtml(diff.leftLine)}</td>` +
                    `<td class="indicator empty-cell"></td>` +
                    `<td class="diff-code empty-cell"></td>`;
            } else if (diff.status === 'modified') {
                const leftIndTd = document.createElement('td');
                leftIndTd.className = 'indicator indicator-removed';
                leftIndTd.textContent = '-';

                const leftCodeTd = document.createElement('td');
                leftCodeTd.className = 'diff-code diff-code-left';

                const rightIndTd = document.createElement('td');
                rightIndTd.className = 'indicator indicator-added';
                rightIndTd.textContent = '+';

                const rightCodeTd = document.createElement('td');
                rightCodeTd.className = 'diff-code diff-code-right';

                if (diff.leftHighlight && diff.rightHighlight) {
                    leftCodeTd.innerHTML = this.renderHighlights(diff.leftHighlight, 'removed', diff.key, diff.fileType);
                    rightCodeTd.innerHTML = this.renderHighlights(diff.rightHighlight, 'added', diff.key, diff.fileType);
                } else {
                    leftCodeTd.textContent = diff.leftLine;
                    rightCodeTd.textContent = diff.rightLine;
                }

                row.appendChild(leftIndTd);
                row.appendChild(leftCodeTd);
                row.appendChild(rightIndTd);
                row.appendChild(rightCodeTd);
            } else {
                // unchanged
                row.innerHTML =
                    `<td class="indicator"></td>` +
                    `<td class="diff-code diff-code-left">${escapeHtml(diff.leftLine)}</td>` +
                    `<td class="indicator"></td>` +
                    `<td class="diff-code diff-code-right">${escapeHtml(diff.rightLine)}</td>`;
            }

            table.appendChild(row);
        }

        container.innerHTML = '';
        container.appendChild(table);

        // After rendering, synchronize row heights so left & right content cells stay aligned
        // even when one side wraps more lines than the other.
        this.syncRowHeights(table);
        // Re-sync on window resize since wrapping can change
        this._resizeHandler = () => this.syncRowHeights(table);
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Forces each row's left and right content cells to the same height.
     * Because the table uses table-layout:fixed, natural row height already
     * matches the tallest cell. But we reset any previously forced heights
     * first so the browser can recalculate.
     */
    syncRowHeights(table) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td.diff-code');
            // Reset forced heights
            for (const cell of cells) {
                cell.style.height = '';
            }
        }
        // Now read computed heights and force alignment
        for (const row of rows) {
            const cells = row.querySelectorAll('td.diff-code');
            if (cells.length === 2) {
                const h0 = cells[0].offsetHeight;
                const h1 = cells[1].offsetHeight;
                if (h0 !== h1) {
                    const max = Math.max(h0, h1) + 'px';
                    cells[0].style.height = max;
                    cells[1].style.height = max;
                }
            }
        }
    }
    
    /**
     * Renders character-level highlights
     */
    renderHighlights(highlights, changeType, key, fileType) {
        if (!Array.isArray(highlights)) return escapeHtml(key || '');
        const wordClass = changeType === 'added' ? 'added-word' : 'removed-word';
        const separator = fileType === 'properties' ? '=' : ': ';
        const keyPrefix = escapeHtml((key || '') + separator);
        
        const valueHtml = highlights.map(segment => {
            if (!segment) return '';
            if (segment.type === changeType) {
                return `<span class="${wordClass}">${escapeHtml(segment.text)}</span>`;
            } else if (segment.type === 'unchanged') {
                return escapeHtml(segment.text);
            }
            return '';
        }).join('');
        
        return keyPrefix + valueHtml;
    }
}

// ==================== MAIN CONTROLLER ====================

document.addEventListener('DOMContentLoaded', () => {
    const compareBtn = document.getElementById('compareBtn');
    const leftTextarea = document.getElementById('leftTextarea');
    const rightTextarea = document.getElementById('rightTextarea');
    const diffContainer = document.getElementById('diffContainer');
    const diffOutput = document.getElementById('diffOutput');
    
    if (!compareBtn || !leftTextarea || !rightTextarea || !diffContainer || !diffOutput) {
        console.error('Config Differ: Required DOM elements not found.');
        return;
    }
    
    compareBtn.addEventListener('click', () => {
        try {
            // Get input values
            const leftText = leftTextarea.value;
            const rightText = rightTextarea.value;
            const fileTypeEl = document.querySelector('input[name="fileType"]:checked');
            const fileType = fileTypeEl ? fileTypeEl.value : 'properties';
            
            // Validate inputs
            if (!leftText.trim() || !rightText.trim()) {
                alert('Please enter content in both textareas');
                return;
            }
            
            let leftData, rightData;
            
            // Parse based on file type
            if (fileType === 'properties') {
                const parser = new PropertyParser();
                const leftParsed = parser.parse(leftText);
                const rightParsed = parser.parse(rightText);
                leftData = parser.sort(leftParsed);
                rightData = parser.sort(rightParsed);
            } else {
                const parser = new YAMLParser();
                const leftParsed = parser.parse(leftText);
                const rightParsed = parser.parse(rightText);
                leftData = parser.sortRecursively(leftParsed);
                rightData = parser.sortRecursively(rightParsed);
            }
            
            // Generate diff
            const diffEngine = new DiffEngine();
            const diffResults = diffEngine.compare(leftData, rightData, fileType);
            
            // Render diff
            const renderer = new DiffRenderer();
            renderer.render(diffResults, diffOutput);
            
            // Show diff container
            diffContainer.style.display = 'block';
            
            // Scroll to results
            diffContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
        } catch (error) {
            alert('Error: ' + error.message);
            console.error('Detailed error:', error);
        }
    });
});
