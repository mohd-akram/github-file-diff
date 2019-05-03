dir=src/vendor
mkdir -p $dir

# diff
cp node_modules/diff/dist/diff.js $dir

# cash
cp node_modules/cash-dom/dist/cash.js $dir
echo 'jQuery = cash;' > $dir/jquery.js

# diff2html
diff2html=node_modules/diff2html/dist/diff2html
cp $diff2html.css $dir
cat $diff2html.js $diff2html-ui.js | sed "
s/d2h-ins/blob-code-addition/
s/d2h-del/blob-code-deletion/
s/d2h-file-header/file-header/
s/d2h-file-wrapper/file/
s/d2h-file-name-wrapper/file-info/
" > $dir/diff2html.js

# highlight.js
highlightjs=node_modules/highlight.js
cp $highlightjs/lib/highlight.js $highlightjs/styles/github.css $dir
mkdir -p $dir/languages
for f in node_modules/highlight.js/lib/languages/*; do
	b=${f##*/}
	n=${b%???}
	# arduino depends on cpp so put it after
	if [ "$n" = "arduino" ]; then
		b="cpparduino.js"
	fi
	sed "
	s/module.exports =/hljs.registerLanguage(\"$n\",/
	s/^};/});/
	" $f > $dir/languages/$b;
done

cat $dir/github.css $dir/diff2html.css > src/vendor.css
cat $dir/*.js $dir/languages/*.js > src/vendor.js
