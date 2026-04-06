#!/usr/bin/env node
/**
 * 修复上游 jiti tryNative 在 Windows 上的 ESM URL 错误
 *
 * 上游 bug: 多个 dist 文件中的 tryNative 逻辑使用
 *   shouldPreferNativeJiti(modulePath) || modulePath.includes(`${path.sep}dist${path.sep}`)
 * 在 Windows 上，shouldPreferNativeJiti() 已返回 false，但 || 后面的
 * dist 路径检查绕过了 win32 保护，导致 jiti 尝试用原生 ESM import()
 * 加载原始 Windows 路径 (C:\...)，触发 ERR_UNSUPPORTED_ESM_URL_SCHEME。
 *
 * 此脚本在构建后 patch dist 文件，添加 process.platform !== "win32" guard。
 *
 * 用法: node scripts/patch-esm-win32.mjs <openclaw-dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('用法: node scripts/patch-esm-win32.mjs <openclaw-dir>');
  process.exit(1);
}

const distDir = path.join(targetDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.error(`❌ dist 目录不存在: ${distDir}`);
  process.exit(1);
}

const BUG_PATTERN = /shouldPreferNativeJiti\(modulePath\) \|\| modulePath\.includes\(/g;
const FIX_STR = 'shouldPreferNativeJiti(modulePath) || (process.platform !== "win32" && modulePath.includes(';

const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
let patched = 0;

for (const file of files) {
  const filePath = path.join(distDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (BUG_PATTERN.test(content)) {
    BUG_PATTERN.lastIndex = 0;
    const fixed = content.replace(BUG_PATTERN, FIX_STR);
    fs.writeFileSync(filePath, fixed, 'utf8');
    patched++;
    console.log(`  ✅ ${file}`);
  }
}

if (patched > 0) {
  console.log(`🔧 ESM Win32 patch: ${patched} 个文件已修复`);
} else {
  console.log('ℹ️  ESM Win32 patch: 无需修复（上游可能已修复）');
}
