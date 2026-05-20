const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = path.join(__dirname, 'cccd-extension');
const DIST_DIR = path.join(__dirname, 'dist');
const ENCRYPTION_KEY = Buffer.from('DOCX_KEY_1905');

function encryptBuffer(buffer) {
    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        out[i] = buffer[i] ^ ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
    }
    return out;
}

// Obfuscation configuration (High Obfuscation, Low Performance is fine for an extension like this)
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
};

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (src.endsWith('.js') && !src.includes('jszip.min.js') && !src.includes('release.js')) {
            console.log(`Obfuscating: ${src}`);
            const code = fs.readFileSync(src, 'utf8');
            try {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
                fs.writeFileSync(dest, obfuscationResult.getObfuscatedCode());
            } catch (err) {
                console.error(`Failed to obfuscate ${src}`, err);
            }
        } else if (src.endsWith('.docx')) {
            console.log(`Encrypting: ${src}`);
            const buffer = fs.readFileSync(src);
            const encryptedBuffer = encryptBuffer(buffer);
            const destEnc = dest.replace('.docx', '.enc');
            fs.writeFileSync(destEnc, encryptedBuffer);
        } else {
            console.log(`Copying: ${src}`);
            fs.copyFileSync(src, dest);
        }
    }
}

// Clean dist dir
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

console.log('Building to dist/ directory...');
copyRecursiveSync(SRC_DIR, DIST_DIR);
console.log('Build complete! Load the "dist" folder into Chrome.');
