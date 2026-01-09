const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(__dirname, '../node_modules/@embedpdf/snippet/dist');
const TARGET_DIR = path.resolve(__dirname, '../media');

// Files to preserved in media/ (User custom code)
const PRESERVED_FILES = [
    'editor.js',
    'editor.css',
    'vscode-context.js'
];

function updateMedia() {
    console.log(`Update Media: ${SOURCE_DIR} -> ${TARGET_DIR}`);

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Error: Source directory not found: ${SOURCE_DIR}`);
        console.error('Run "npm install" first.');
        process.exit(1);
    }

    // 1. Clean old vendored files
    const files = fs.readdirSync(TARGET_DIR);
    let cleanedCount = 0;
    for (const file of files) {
        if (!PRESERVED_FILES.includes(file)) {
            // Delete old hashed files and the entry point
            if (file.startsWith('embedpdf-') ||
                file.startsWith('worker-engine-') ||
                file.startsWith('direct-engine-') ||
                file.startsWith('browser-') ||
                file === 'pdfium.wasm' ||
                file === 'embed-pdf-viewer.min.js') {

                fs.unlinkSync(path.join(TARGET_DIR, file));
                cleanedCount++;
            }
        }
    }
    console.log(`Cleaned ${cleanedCount} old files.`);

    // 2. Copy new files
    const newFiles = fs.readdirSync(SOURCE_DIR);
    let copiedCount = 0;

    for (const file of newFiles) {
        // Copy main entry point and rename it
        if (file === 'embedpdf.js') {
            fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(TARGET_DIR, 'embed-pdf-viewer.min.js'));
            copiedCount++;
            continue;
        }

        // Copy other assets (WASM, hashed JS chunks)
        if (file.endsWith('.js') || file.endsWith('.wasm')) {
            fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(TARGET_DIR, file));
            copiedCount++;
        }
    }

    console.log(`Copied ${copiedCount} new files.`);
    console.log('Update complete.');
}

updateMedia();
