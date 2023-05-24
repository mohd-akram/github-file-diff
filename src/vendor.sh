dir=src/vendor
mkdir -p $dir

# diff
cp node_modules/diff/dist/diff.js $dir

# diff2html
diff2html=node_modules/diff2html/bundles
cp $diff2html/css/diff2html.min.css $dir
cat $diff2html/js/diff2html.min.js $diff2html/js/diff2html-ui.min.js | sed "
s/d2h-info/blob-code-hunk/g
s/d2h-cntx/blob-code-context/g
s/d2h-ins/blob-code-addition/g
s/d2h-del/blob-code-deletion/g
s/d2h-file-header/file-header/g
s/d2h-file-wrapper/file/g
s/d2h-file-name-wrapper/file-info/g
" > $dir/diff2html.js

# highlight.js
cp node_modules/highlight.js/styles/github.css $dir

cat $dir/github.css $dir/diff2html.min.css - > src/vendor.css <<CSS
.d2h-wrapper .file-header {
  display: flex;
}
.d2h-wrapper .file-info {
  width: 100%;
}
.d2h-wrapper .blob-code-context,
.d2h-wrapper .blob-code-addition,
.d2h-wrapper .blob-code-deletion {
  padding: unset;
}
.d2h-file-collapse {
  border: unset;
}
.d2h-file-collapse.d2h-selected {
  background: unset;
}
.d2h-icon, .d2h-tag {
  display: none;
}
.d2h-code-linenumber {
  border: unset;
  background: unset;
  color: var(--color-fg-subtle);
}
.d2h-code-linenumber.blob-code-addition {
  color: var(--color-diff-blob-addition-num-text);
}
.d2h-code-linenumber.blob-code-deletion {
  color: var(--color-diff-blob-deletion-num-text);
}
.d2h-code-line-ctn {
  vertical-align: unset;
}
.d2h-code-line ins {
  background-color: var(--color-diff-blob-addition-word-bg);
}
.d2h-code-line del {
  background-color: var(--color-diff-blob-deletion-word-bg);
}

.hljs {
  color: unset;
}
.hljs-subst {
  color: var(--color-prettylights-syntax-storage-modifier-import);
}
.hljs-comment, .hljs-code, .hljs-formula {
  color: var(--color-prettylights-syntax-comment);
}
.hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number,
.hljs-operator, .hljs-variable, .hljs-selector-attr, .hljs-selector-class,
.hljs-selector-id,
.hljs-built_in, .hljs-symbol,
.hljs-section {
  color: var(--color-prettylights-syntax-constant);
}
.hljs-doctag, .hljs-keyword, .hljs-meta .hljs-keyword, .hljs-template-tag,
.hljs-template-variable, .hljs-type, .hljs-variable.language_ {
  color: var(--color-prettylights-syntax-keyword);
}
.hljs-name, .hljs-quote, .hljs-selector-tag, .hljs-selector-pseudo {
  color: var(--color-prettylights-syntax-entity-tag);
}
.hljs-regexp, .hljs-string, .hljs-meta .hljs-string {
  color: var(--color-prettylights-syntax-string);
}
.hljs-title, .hljs-title.class_, .hljs-title.class_.inherited__,
.hljs-title.function_ {
  color: var(--color-prettylights-syntax-entity);
}
.hljs-addition {
  color: var(--color-prettylights-syntax-markup-inserted-text);
  background-color: var(--color-prettylights-syntax-markup-inserted-bg);
}
.hljs-deletion {
  color: var(--color-prettylights-syntax-markup-deleted-text);
  background-color: var(--color-prettylights-syntax-markup-deleted-bg);
}
CSS
cat $dir/*.js > src/vendor.js
