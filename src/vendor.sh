dir=src/vendor
mkdir -p $dir

# diff
cp node_modules/diff/dist/diff.js $dir

# cash
cp node_modules/cash-dom/dist/cash.js $dir
echo 'jQuery = cash;' > $dir/jquery.js

# diff2html
cp node_modules/diff2html/dist/diff2html.css $dir
cat node_modules/diff2html/dist/diff2html{,-ui}.js | sed "
s/d2h-ins/blob-code-addition/
s/d2h-del/blob-code-deletion/
s/d2h-file-header/file-header/
s/d2h-file-wrapper/file/
s/d2h-file-name-wrapper/file-info/
" > $dir/diff2html.js && patch -p0 <<EOF
--- src/vendor/diff2html.js.orig	2019-04-17 18:44:00.000000000 +0400
+++ src/vendor/diff2html.js	2019-04-17 18:44:34.000000000 +0400
@@ -6687,8 +6687,7 @@
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#x27;')
-      .replace(/\//g, '&#x2F;')
-      .replace(/\t/g, '    ');
+      .replace(/\//g, '&#x2F;');
   };

   Utils.prototype.startsWith = function(str, start) {
EOF

# highlight.js
cp node_modules/highlight.js/{lib/highlight.js,styles/github.css} $dir
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

cat $dir/{github,diff2html}.css > src/vendor.css
cat $dir/*.js $dir/languages/*.js > src/vendor.js
