/*! Image Zoom - v1
 *  Copyright (c) 2016 Mattias Hinderson
 *  License: MIT
 */

(function (window, factory) {
    'use strict';

    if (typeof define == 'function' && define.amd) {
        // AMD
        define([
            './utils',
            './pubsub'
        ], function(utils, pubsub) {
            return factory(window, utils, pubsub);
        });
    } else if (typeof exports == 'object') {
        // CommonJS
        module.exports = factory(
            window,
            require('./utils'),
            require('./pubsub')
        );
    }

}(window, function factory (window, utils, pubsub) {
    'use strict';

    // Constants
    var OFFSET = 60;

    // Cached values
    var cache = {
        ticking: false,
        lastScrollY: window.pageYOffset,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
    };

    // Window events
    var resizeEvent = utils.debounce(function ( ) {
    	cache.viewportWidth = window.innerWidth;
    	cache.viewportHeight = window.innerHeight;
        cache.lastScrollY = window.pageYOffset;
    }, 250);

    var scrollEvent = function ( ) {
    	var requestTick = function ( ) {
            cache.lastScrollY = window.pageYOffset;

    		// Stop ticking
    		cache.ticking = false;
    	};

    	if (!cache.ticking) {
    		utils.requestAnimFrame.call(window, requestTick);
    		cache.ticking = true;
    	}
    };

    window.addEventListener('resize', resizeEvent);
    window.addEventListener('scroll', scrollEvent);


    function calculateZoom (imageRect, thumbRect) {
        var highResImageWidth = imageRect.width;
        var highResImageHeight = imageRect.height;

        var viewportHeight = cache.viewportHeight - OFFSET;
        var viewportWidth  = cache.viewportWidth - OFFSET;

        var maxScaleFactor = highResImageWidth / thumbRect.width;

        var imageAspectRatio = thumbRect.width / thumbRect.height;
        var viewPortAspectRatio = viewportWidth / viewportHeight;

        var imgScaleFactor;
        if (highResImageWidth < viewportWidth && highResImageHeight < viewportHeight) {
            imgScaleFactor = maxScaleFactor;
        } else if (imageAspectRatio < viewPortAspectRatio) {
            imgScaleFactor = (viewportHeight / highResImageHeight) * maxScaleFactor;
        } else {
            imgScaleFactor = (viewportWidth / highResImageWidth) * maxScaleFactor;
        }

        return imgScaleFactor;
    }

    function zoomOut (e) {
        var image = (e && e.target.nodeName === 'IMG') ? e.target : document.querySelector('[data-zoomable].is-zoomed img');
        if (!image) { return; }

        var container = image.parentNode;

        pubsub.publish('zoomOutStart', container);

        // Reset transforms
        utils.requestAnimFrame.call(window, function ( ) {
            document.body.classList.remove('zoom-overlay-active');

            container.classList.remove('is-zoomed');

            image.style.msTransform = '';
            image.style.webkitTransform = '';
            image.style.transform = '';
        });

        // Wait for transition to end
        var transitionEvent = utils.whichTransitionEvent();
        image.addEventListener(transitionEvent, function resetImage ( ) {
            image.removeEventListener(transitionEvent, resetImage);

            container.classList.remove('is-active');

            pubsub.publish('zoomOutEnd', container);
        });
    }

    function zoomIn (e) {
        var transitionEvent = utils.whichTransitionEvent();
        var image = e.target;
        var container = image.parentNode;
        var thumbRect = image.getBoundingClientRect();
        var imageRect = {
            width: container.getAttribute('data-width'),
            height: container.getAttribute('data-height'),
        };

        pubsub.publish('zoomInStart', container);

        container.classList.add('is-active');

        // Force repaint
        var repaint = image.offsetWidth;

        // Calculate offset
        var viewportY = cache.viewportHeight / 2;
        var viewportX = cache.viewportWidth / 2;
        var imageCenterY = thumbRect.top + (thumbRect.height / 2);
        var imageCenterX = thumbRect.left + (thumbRect.width / 2);
        var translate = 'translate3d(' + (viewportX - imageCenterX) + 'px, ' + (viewportY - imageCenterY) + 'px, 0)';

        // Calculate scale ratio
        var scale = 'scale(' + calculateZoom(imageRect, thumbRect) + ')';

        // Apply transforms
        utils.requestAnimFrame.call(window, function ( ) {
            // Disable scroll for entire document element and add click event
            document.body.classList.add('zoom-overlay-active');

            container.classList.add('is-zooming');

            // Set explicit dimensions to avoid max-width issues
            image.setAttribute('width', imageRect.width);
            image.setAttribute('height', imageRect.height);

            image.style.msTransform = translate + ' ' + scale;
            image.style.webkitTransform = translate + ' ' + scale;
            image.style.transform = translate + ' ' + scale;
        });

        // Events
        window.addEventListener('keydown', function keysPressed (e) {
            e = e || window.event;

            if (e.which === 27 || e.keyCode === 27) {
                zoomOut();
                window.removeEventListener('keydown', keysPressed);
            }
        });

        // Wait for transition to end
        image.addEventListener(transitionEvent, function activateImage ( ) {
            image.removeEventListener(transitionEvent, activateImage);
            pubsub.publish('zoomInEnd', container);

            container.classList.remove('is-zooming');
            container.classList.add('is-zoomed');

            // Load high-res image
            if (image.hasAttribute('srcset')) {
                image.removeAttribute('srcset');
            }
            if (image.hasAttribute('sizes')) {
                image.removeAttribute('sizes');
            }
            image.src = container.getAttribute('href');
            pubsub.publish('imageLoaded', image);
        });
    }

    function toggleZoom (e) {
        e.preventDefault();

        var container = e.target.parentNode;
        if (container.classList.contains('is-zoomed')) {
            zoomOut(e);
        } else {
            zoomIn(e);
        }
    }

    function ImageZoom (elems, options) {
        if (!elems) return;

        // Update default options
        if (options) {
            OFFSET = options.offset;
        }

        // Export event emitter
        this.on = pubsub.subscribe;

        // Attach click event listeners to all provided elems
        utils.forEach(elems, function (index, link) {
            link.addEventListener('click', toggleZoom);
        });
    }

	// Expose to interface
	if (typeof module === 'object' && typeof module.exports === 'object') {
		// CommonJS, just export
		module.exports = ImageZoom;
	} else if (typeof define === 'function' && define.amd) {
		// AMD support
		define('ImageZoom', function ( ) { return ImageZoom; } );
	}

}));