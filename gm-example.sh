# gm identify -verbose ./app/resources/homer.jpg

gm convert \
	./app/resources/homer.jpg \
	-font ./app/resources/Outfit.ttf \
	-pointsize 50 \
	-fill "#fff" \
	-stroke "#000" \
	-strokewidth 1 \
	-draw "gravity center 0,-155 \"Quando perguntam:\"" \
	-draw "gravity center 0,155 \"Quem é o mais feio?:\"" \
	output.png

echo "complete"
