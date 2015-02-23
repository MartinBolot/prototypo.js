/*jshint -W098 */
var plumin = require('../node_modules/plumin.js/dist/plumin.js'),
	paper = plumin.paper,
	Utils = require('./Utils.js'),
	naive = require('./naive.js');

function ParametricFont( src ) {
	var fontinfo,
		font,
		name,
		glyphSrc,
		glyph;

	// TODO: this block is only here for backward compat
	// and should be removed at some point in the future
	if ( !src.fontinfo ) {
		src.fontinfo = src.info;
	}

	font = new paper.Font( src.fontinfo );

	font.src = src;

	for ( name in src.glyphs ) {
		glyphSrc = src.glyphs[name];

		Utils.ufoToPaper( glyphSrc );

		Utils.createUpdaters( glyphSrc, 'glyphs/glyph_' + name );

		glyph = Utils.glyphFromSrc( glyphSrc );

		font.addGlyph( glyph );

		naive.expandSkeletons( glyph );

		glyph.solvingOrder = Utils.solveDependencyTree( glyphSrc ).map(function(path) {
			return path.split('.');
		});
	}

	return font;
}

plumin.ParametricFont = ParametricFont;
plumin.Utils = Utils;
plumin.Utils.naive = naive;

paper.PaperScope.prototype.Font.prototype.update = function( params, set ) {
	return this.getGlyphSubset( set ).map(function( glyph ) {
		return glyph.update( params, this );
	}, this);
};


paper.PaperScope.prototype.Glyph.prototype.update = function( params ) {
	this.solvingOrder.forEach(function(path) {
		var propName = path[path.length -1],
			src = Utils.propFromPath( path, path.length, this.src ),
			obj = Utils.propFromPath( path, path.length -1, this ),
			result = src && src._updater.apply( obj,
				[ propName, this.contours, this.anchors, this.parentAnchors, Utils ].concat(
					src._parameters.map(function(name) {
						return params[name];
					})
				)
			);

		// Assume that updaters returning undefined have their own assignment logic
		if ( result !== undefined ) {
			obj[propName] = result;
		}
	}, this);

	this.contours.forEach(function(contour) {
		// prepare and update outlines and expanded contours, but not skeletons
		if ( contour.skeleton !== true ) {
			// Previously prepareContour was only executed on outlines and skeletons
			// but not on expanded contours.
			// I have no idea why but I might rediscover it later.
			naive.prepareContour( contour );
			naive.updateContour( contour, params );
		}
	});

	// transformation should be the very last step
	this.contours.forEach(function(contour) {
		// 1. transform the contour
		// prepare and update outlines and expanded contours, but not skeletons
		if ( contour.transforms ) {
			var matrix = Utils.transformsToMatrix( contour.transforms, contour.transformOrigin );

			if ( contour.skeleton !== true ) {
				contour.transform( matrix );

			// when dealing with a skeleton, apply transforms only to expanded items
			} else {
				contour.expandedTo.forEach(function( contour ) {
					contour.transform( matrix );
				});
			}
		}

		// 2. transform the nodes
		contour.nodes.forEach(function(node) {
			if ( node.transforms ) {
				matrix = Utils.transformsToMatrix( node.transforms, node.transformOrigin );

				if ( contour.skeleton !== true ) {
					node.transform( matrix );

				// when dealing with a skeleton, apply transforms only to expanded items
				} else {
					node.expandedTo.forEach(function( node ) {
						node.transform( matrix );
					});
				}
			}
		});
	});

	// TODO: handle components and components transforms
};

module.exports = plumin;