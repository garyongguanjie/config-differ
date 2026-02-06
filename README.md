# Config Differ

A side-by-side diff tool for Spring Boot `.properties` and YAML configuration files with automatic key sorting.

## Features

- 📝 **Compare Config Files** - Side-by-side comparison of Spring Boot properties and YAML files
- 🔤 **Automatic Sorting** - Alphabetically sorts keys (recursive for YAML nested objects)
- 💬 **Comment Preservation** - Maintains comments associated with their keys
- 🎨 **GitHub-Style Diff** - Familiar green/red highlighting for changes
- 🌐 **Client-Side Only** - Runs entirely in browser, no server needed
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⚡ **No Dependencies** - Pure HTML, CSS, and JavaScript

## Live Demo

[Try it now on GitHub Pages](https://yourusername.github.io/config-differ/)

## Usage

1. **Paste Original Config** - Copy your original configuration into the left textarea
2. **Paste New Config** - Copy your modified configuration into the right textarea
3. **Select File Type** - Choose either "Properties" or "YAML" format
4. **Click Compare** - View the sorted, side-by-side diff below

## Diff Color Legend

| Color | Meaning |
|-------|---------|
| 🟢 Light Green Background | Added lines (present in new config only) |
| 🔴 Light Red Background | Removed lines (present in original config only) |
| ⚪ White Background | Unchanged lines (identical in both configs) |
| 🟢 Dark Green Highlight | Character-level additions within modified values |
| 🔴 Dark Red Highlight | Character-level deletions within modified values |

## Supported Formats

### Spring Boot Properties
```properties
# Database Configuration
server.port=8080
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=admin
```

### YAML
```yaml
# Server Configuration
server:
  port: 8080
  context-path: /api
spring:
  application:
    name: myapp
```

## How It Works

1. **Parsing** - Parses properties or YAML format, preserving comments
2. **Sorting** - Alphabetically sorts keys (recursively for nested YAML)
3. **Comparison** - Identifies added, removed, modified, and unchanged lines
4. **Character Diff** - Uses Longest Common Subsequence (LCS) algorithm for character-level highlighting
5. **Rendering** - Displays GitHub-style side-by-side diff with color coding

## Deployment to GitHub Pages

### Option 1: Direct Deploy

1. Create a new repository named `config-differ`
2. Upload all files (`index.html`, `styles.css`, `app.js`, `README.md`)
3. Go to **Settings** → **Pages**
4. Under **Source**, select **Deploy from a branch**
5. Select **main** branch and **/ (root)** folder
6. Click **Save**
7. Your site will be available at `https://yourusername.github.io/config-differ/`

### Option 2: Clone and Deploy

```bash
git clone https://github.com/yourusername/config-differ.git
cd config-differ
git add .
git commit -m "Initial commit"
git push origin main
```

Then enable GitHub Pages in repository settings as described above.

## Technical Details

### Architecture

- **PropertyParser** - Parses Spring Boot `.properties` files, handles multi-line values and comments
- **YAMLParser** - Recursive descent parser for YAML with comment preservation
- **DiffEngine** - Compares sorted configs and classifies changes
- **LCS Algorithm** - Character-level diff using dynamic programming
- **DiffRenderer** - Generates GitHub-style HTML table output

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Limitations

- **YAML Anchors/Aliases** - Limited support for YAML anchors (`&`) and aliases (`*`)
- **Complex YAML** - Very complex nested structures may have edge cases
- **Performance** - Large files (10,000+ lines) may experience slowness
- **Encoding** - Assumes UTF-8 encoding

## Examples

### Properties File Comparison

**Before:**
```properties
server.port=8080
spring.datasource.url=jdbc:mysql://localhost:3306/db
```

**After:**
```properties
server.port=9090
spring.datasource.url=jdbc:postgresql://localhost:5432/db
spring.datasource.username=admin
```

**Diff Output:**
- `server.port` - Modified (8080 → 9090) with character highlighting
- `spring.datasource.url` - Modified (mysql → postgresql) with character highlighting
- `spring.datasource.username` - Added (green background)

### YAML File Comparison

**Before:**
```yaml
server:
  port: 8080
spring:
  application:
    name: myapp
```

**After:**
```yaml
server:
  port: 8080
  context-path: /api
spring:
  application:
    name: myapp-v2
```

**Diff Output:**
- `server.context-path` - Added (green background)
- `spring.application.name` - Modified (myapp → myapp-v2) with character highlighting

## Contributing

Contributions are welcome! Feel free to:

- Report bugs via GitHub Issues
- Submit feature requests
- Create pull requests for improvements

## License

MIT License - feel free to use this tool for any purpose.

## Author

Created as a simple, dependency-free config diff tool for developers working with Spring Boot applications.

---

**Note:** This tool runs entirely in your browser. No data is sent to any server. All processing happens client-side.
