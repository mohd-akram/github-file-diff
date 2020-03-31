dir=src/vendor
mkdir -p $dir

# diff
cp node_modules/diff/dist/diff.js $dir

# diff2html
diff2html=node_modules/diff2html/bundles
cp $diff2html/css/diff2html.min.css $dir
cat $diff2html/js/diff2html.min.js $diff2html/js/diff2html-ui.min.js | sed "
s/d2h-ins/blob-code-addition/g
s/d2h-del/blob-code-deletion/g
s/d2h-file-header/file-header/g
s/d2h-file-wrapper/file/g
s/d2h-file-name-wrapper/file-info/g
" > $dir/diff2html.js

# highlight.js
cp node_modules/highlight.js/styles/github.css $dir

cat $dir/github.css $dir/diff2html.min.css > src/vendor.css
cat $dir/*.js > src/vendor.js
