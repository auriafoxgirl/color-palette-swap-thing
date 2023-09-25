## palette swap
simple website that replaces all colors in list with other colors in zip file

it was designed for one of the themes in [figura](https://github.com/figuraMC/Figura/) discord [server](https://discord.gg/figuramc)

## how to use
1. select zip file
2. write what colors should be replaced with color in text area like this:
```
<hexColorOfThingToReplace\> <hexColorOfThingToReplaceWith>
```
e.g.
```
b4befe f5c2e7
```
will replace color b4befe with f5c2e7 in all images

you can use multiple lines to replace more colors (default limit is 256)

## libraries
uses [jszip](https://github.com/Stuk/jszip/)