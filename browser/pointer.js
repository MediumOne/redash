// (c) 2020 The ACE Centre-North, UK registered charity 1089313.
// MIT licensed, see https://opensource.org/licenses/MIT

export default class Pointer {
    constructor(svgPiece) {
        this._svgBoundingBox = undefined;

        // TOTH https://github.com/patrickhlauke/touch
        this._touch = 'ontouchstart' in window;

        this._rawX = 0;
        this._rawY = 0;

        // Tunable parameters.
        this._multiplierLeftRight = 1;
        this._multiplierUpDown = 1;

        this._xTextNode = null;
        this._yTextNode = null;
        this._pointerLine = null;

        this._activateCallback = null;
        this._touchEndCallback = null;

        // Setter invocation.
        this.svgPiece = svgPiece;
    }

    get multiplierLeftRight() {return this._multiplierLeftRight;}
    set multiplierLeftRight(multiplierLeftRight) {
        this._multiplierLeftRight = multiplierLeftRight;
    }

    get multiplierUpDown() {return this._multiplierUpDown;}
    set multiplierUpDown(multiplierUpDown) {
        this._multiplierUpDown = multiplierUpDown;
    }

    get x() {return this._rawX * this.multiplierLeftRight;}
    get y() {return this._rawY * this.multiplierUpDown;}
    get going() {return this._rawX !== 0 || this._rawY !== 0;}

    get activateCallback() {return this._activateCallback;}
    set activateCallback(activateCallback) {
        this._activateCallback = activateCallback;
    }

    // Purpose of the touch-end callback is to get into some other code from
    // within a user interaction handler. That supports, for example speech
    // synthesis, which is sometimes blocked outside a user interaction.
    get touchEndCallback() {return this._touchEndCallback;}
    set touchEndCallback(touchEndCallback) {
        this._touchEndCallback = touchEndCallback;
    }

    get rawX() {return this._rawX;}
    get rawY() {return this._rawY;}

    get svgPiece() { return this._svgPiece; }
    set svgPiece(svgPiece) {
        this._svgPiece = svgPiece;

        // Cross hair axis lines.
        this._svgPiece.create('line', {
            x1:"0", y1:"-50%", x2:"0", y2:"50%",
            stroke:"black", "stroke-width":"1px"
        });
        this._svgPiece.create('line', {
            x1:"-50%", y1:"0", x2:"50%", y2:"0",
            stroke:"black", "stroke-width":"1px"
        });

        // Add the pointer line, which will start at the origin and end wherever
        // the pointer happens to be.
        this._pointerLine = this._svgPiece.create('line', {
            x1:"0", y1:"0", x2:"0", y2:"0",
            stroke:"red", "stroke-width":"1px"
        });

        // Add a rect to catch all touch events. If the original target of a
        // touch start is removed from the document, a touch end doesn't get
        // sent. This means that the rect elements in the zoom UI can't be
        // allowed to receive touch starts.  
        // The catcher can't have fill:none because then it doesn't receive
        // touch events at all. So, it has an opacity of zero.  
        // The touch handlers are attached to the svg element, even so, the
        // event will get handled down in the SVG elements.
        this._svgPiece.create('rect', {
            x:"-50%", y:"-50%", width:"100%", height:"100%", id:"catcher",
            'fill-opacity':0
        })

        // Add pointer listeners, either touch or mouse. Desktop Safari doesn't
        // support pointer events like:
        // 
        //     this._svgPiece.addEventListener('pointermove', ...);
        // 
        // So the code here uses mouse events instead.
        if (this._touch) {
            // This code has the same handler for touchstart and touchmove. MDN
            // says that best practice is to add the move and end handlers
            // inside the start handler. However, some other Internet research
            // suggests that this could be too late in the event life cycle to
            // prevent the window from scrolling, which is the default action
            // for a touch-move, or doesn't work on Android. A related point is
            // that the scrolling action is prevented by use of the touch-action
            // CSS feature, called when the SVG node is created.
            this._svgPiece.node.addEventListener(
                'touchstart', this._on_touch.bind(this), {capture:true});
            this._svgPiece.node.addEventListener(
                'touchmove', this._on_touch.bind(this), {capture:true});
            //
            // The same handler is used for touchend and touchcancel but this
            // isn't contentious.
            this._svgPiece.node.addEventListener(
                'touchend', this._on_touch_leave.bind(this), {capture:true});
            this._svgPiece.node.addEventListener(
                'touchcancel', this._on_touch_leave.bind(this), {capture:true});
        }
        else {
            this._svgPiece.node.addEventListener(
                'mousemove', this._on_mouse_move.bind(this), {capture:true});
            this._svgPiece.node.addEventListener(
                'mouseleave', this._on_mouse_leave.bind(this), {capture:true});
        }
    }

    get svgBoundingBox() {return this._svgBoundingBox;}
    set svgBoundingBox(svgBoundingBox) {this._svgBoundingBox = svgBoundingBox;}

    get touch() {return this._touch;}

    get xTextNode() {return this._xTextNode;}
    set xTextNode(xTextNode) {
        this._xTextNode = xTextNode;
        this._update_text_nodes();
    }
    get yTextNode() {return this._yTextNode;}
    set yTextNode(yTextNode) {
        this._yTextNode = yTextNode;
        this._update_text_nodes();
    }
    _update_text_nodes() {
        if (this.xTextNode !== null) {
            this.xTextNode.nodeValue = this._rawX.toFixed();
        }
        if (this.yTextNode !== null) {
            this.yTextNode.nodeValue = this._rawY.toFixed();
        }
    }

    _update_pointer(clientX, clientY) {
        // Check that the pointer isn't out-of-bounds. The pointer will go out
        // of bounds if the user touched the SVG and then moved out of the SVG.
        // Touch events continue to be posted, with the same target, in that
        // case.
        if (
            (this.svgBoundingBox !== undefined) &&
            (clientY >= this.svgBoundingBox.y) &&
            (clientY <= this.svgBoundingBox.y + this.svgBoundingBox.height) &&
            (clientX >= this.svgBoundingBox.x) &&
            (clientX <= this.svgBoundingBox.x + this.svgBoundingBox.width)
        ) {
            if (this.activateCallback !== null) {
                this.activateCallback();
            }
            return this._update_pointer_raw(
                clientX - (
                    this.svgBoundingBox.x + (this.svgBoundingBox.width * 0.5)
                ),
                (
                    this.svgBoundingBox.y + (this.svgBoundingBox.height * 0.5)
                ) - clientY
            );
        }
        else {
            // Out of bounds, send co-ordinates that indicate stopping the
            // touch.
            return this._update_pointer_raw(0, 0);
        }
    }
    _update_pointer_raw(adjustedX, adjustedY) {
        // Update the zoom control properties.
        this._rawX = parseFloat(adjustedX);
        this._rawY = parseFloat(adjustedY);

        // Update the line from the origin to the pointer.
        this._pointerLine.setAttribute('x2', this._rawX);
        this._pointerLine.setAttribute('y2', 0 - this._rawY);

        // Update the diagnostic display.
        this._update_text_nodes();
    }

    _on_mouse_move(mouseEvent) {
        mouseEvent.preventDefault();
        return this._update_pointer(mouseEvent.clientX, mouseEvent.clientY);
    }
    _on_mouse_leave(mouseEvent) {
        // console.log(mouseEvent.target);
        // Mouse Leave events are posted for child nodes too.
        if (Object.is(mouseEvent.target, this._svgPiece.node)) {
            mouseEvent.preventDefault();
            if (this.touchEndCallback !== null) {
                this.touchEndCallback();
            }
            return this._update_pointer_raw(0, 0);
        }
    }

    _on_touch(touchEvent) {
        touchEvent.preventDefault();
        if (event.changedTouches.length !== 1) {
            console.log('touch changes', touchEvent);
            return;
        }
        // For now, only handle the first touch point.
        const touch = event.changedTouches[0];

        // The target in the touch object will be the element in which the touch
        // started, even if the touch has now moved outside it. That's handled
        // downstream from here.

        return this._update_pointer(touch.clientX, touch.clientY);
    }
    _on_touch_leave(touchEvent) {
        touchEvent.preventDefault();
        if (this.touchEndCallback !== null) {
            this.touchEndCallback();
        }
        return this._update_pointer_raw(0, 0);
    }

}