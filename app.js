// ==================== UTILITY FUNCTIONS ====================

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== LCS ALGORITHM FOR CHARACTER-LEVEL DIFF ====================

/**
 * Computes the Longest Common Subsequence matrix for two strings
 */
function computeLCS(str1, str2) {
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
        const lines = text.split('\n');
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
        const lines = text.split('\n');
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
            return [{ key: prefix, value: String(obj), comments: [] }];
        }
        
        for (const key of Object.keys(obj)) {
            const item = obj[key];
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (item && typeof item === 'object' && '_value' in item) {
                if (typeof item._value === 'object' && item._value !== null && Object.keys(item._value).length > 0) {
                    result.push(...this.flatten(item._value, fullKey));
                } else {
                    result.push({
                        key: fullKey,
                        value: String(item._value),
                        comments: item._comments || []
                    });
                }
            } else {
                result.push(...this.flatten(item, fullKey));
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
            const leftValue = leftEntries.get(key);
            const rightValue = rightEntries.get(key);
            
            if (!leftValue && rightValue) {
                // Added
                diffResults.push({
                    status: 'added',
                    leftLine: '',
                    rightLine: this.formatLine(key, rightValue, fileType),
                    leftHighlight: null,
                    rightHighlight: null
                });
            } else if (leftValue && !rightValue) {
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
        for (const entry of entries) {
            if (entry.type === 'property') {
                map.set(entry.key, entry.value);
            }
        }
        return map;
    }
    
    /**
     * Converts YAML flat entries to a Map of key->value
     */
    yamlToMap(entries) {
        const map = new Map();
        for (const entry of entries) {
            map.set(entry.key, entry.value);
        }
        return map;
    }
    
    /**
     * Formats a key-value pair as a display line
     */
    formatLine(key, value, fileType) {
        if (fileType === 'properties') {
            return `${key}=${value}`;
        } else {
            return `${key}: ${value}`;
        }
    }
}

// ==================== DIFF RENDERER ====================

class DiffRenderer {
    /**
     * Renders the diff results as an HTML table
     */
    render(diffData, container) {
        const table = document.createElement('table');
        table.className = 'diff-table';
        
        for (const diff of diffData) {
            const row = document.createElement('tr');
            
            if (diff.status === 'added') {
                row.className = 'added';
                row.innerHTML = `
                    <td class="empty-cell"></td>
                    <td>${escapeHtml(diff.rightLine)}</td>
                `;
            } else if (diff.status === 'removed') {
                row.className = 'removed';
                row.innerHTML = `
                    <td>${escapeHtml(diff.leftLine)}</td>
                    <td class="empty-cell"></td>
                `;
            } else if (diff.status === 'modified') {
                row.className = 'modified-both';
                const leftCell = document.createElement('td');
                const rightCell = document.createElement('td');
                
                if (diff.leftHighlight && diff.rightHighlight) {
                    leftCell.innerHTML = this.renderHighlights(diff.leftHighlight, 'removed', diff.key, diff.fileType);
                    rightCell.innerHTML = this.renderHighlights(diff.rightHighlight, 'added', diff.key, diff.fileType);
                } else {
                    leftCell.textContent = diff.leftLine;
                    rightCell.textContent = diff.rightLine;
                }
                
                row.appendChild(leftCell);
                row.appendChild(rightCell);
            } else {
                row.className = 'unchanged';
                row.innerHTML = `
                    <td>${escapeHtml(diff.leftLine)}</td>
                    <td>${escapeHtml(diff.rightLine)}</td>
                `;
            }
            
            table.appendChild(row);
        }
        
        container.innerHTML = '';
        container.appendChild(table);
    }
    
    /**
     * Renders character-level highlights
     */
    renderHighlights(highlights, changeType, key, fileType) {
        const wordClass = changeType === 'added' ? 'added-word' : 'removed-word';
        const separator = fileType === 'properties' ? '=' : ': ';
        const keyPrefix = escapeHtml(key + separator);
        
        const valueHtml = highlights.map(segment => {
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
    
    compareBtn.addEventListener('click', () => {
        try {
            // Get input values
            const leftText = leftTextarea.value;
            const rightText = rightTextarea.value;
            const fileType = document.querySelector('input[name="fileType"]:checked').value;
            
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
