import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('generation UI shows an estimated one minute wait', () => {
  assert.match(read('components/CutePrinter2D.tsx'), /预计 1 分钟左右/);
});

test('style placeholder explains users can choose a preset and generate directly', () => {
  assert.match(read('components/CutePrinter2D.tsx'), /也可以直接在下面按钮选择一种风格，并直接点击生成贴纸即可/);
});

test('sticker prompt keeps text and decorations close to the character to avoid split cuts', () => {
  const source = read('services/geminiService.ts');
  assert.match(source, /对话文字、装饰图案、动作符号/);
  assert.match(source, /10px 以内/);
});

test('default LINE sticker prompt strongly prefers flat 2D sticker art and rejects 3D rendering', () => {
  const source = read('services/geminiService.ts');
  assert.match(source, /经典 LINE 聊天贴纸风/);
  assert.match(source, /扁平 2D 手绘/);
  assert.match(source, /粗黑色线稿/);
  assert.match(source, /厚白色贴纸描边/);
  assert.match(source, /不要 3D/);
  assert.match(source, /不要真实光影/);
});

test('completed printer is hidden once stickers exist', () => {
  assert.match(read('App.tsx'), /segments\.length === 0/);
});
