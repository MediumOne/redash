// (c) 2020 The ACE Centre-North, UK registered charity 1089313.
// MIT licensed, see https://opensource.org/licenses/MIT

export default class ControllerPointer {
    constructor(pointer, predictor) {
        this._pointer = pointer;
        this._predictor = predictor;

        this._rootSpecification = {
            "colour":"silver", "message":[],
            "spawner":this, "prediction": null
        };
    }

    get rootSpecification() {return this._rootSpecification;}

    get going() {return this._pointer.going;}

    child_specifications(zoomBox) {
        const predictions = this._predictor(
            zoomBox.message, zoomBox.prediction);

        return predictions.map((prediction, index) => {
            const codePoint = prediction.codePoint;

            const message = zoomBox.messageCodePoints.slice();
            if (codePoint !== null) {
                message.push(codePoint);
            }

            const displayTextIndex = (
                codePoint === null ? undefined :
                ControllerPointer.displayTextLeft.indexOf(codePoint));
            const displayText = (
                displayTextIndex === undefined ? null :
                String.fromCodePoint(
                    displayTextIndex >= 0 ?
                    ControllerPointer.displayTextMap[displayTextIndex][1] :
                    codePoint
                )
            );
            
            let colour = ControllerPointer.unsetColour;
            if (prediction.group === null) {
                prediction.ordinal = (
                    zoomBox.prediction === null ? 0 :
                    zoomBox.prediction.ordinal + 1
                );
                colour = ControllerPointer.sequenceColours[
                    (index % 2) + ((prediction.ordinal % 2) * 2)];
            }
            else {
                prediction.ordinal = 0;
                if (prediction.group in ControllerPointer.groupColours) {
                    colour = ControllerPointer.groupColours[prediction.group];
                }
            }

            return {
                "prediction": prediction,
                "colour": colour,
                "message": message,
                "text": displayText,
                "weight": prediction.weight,
                "spawner": this
            };
        });
    }

    populate(rootBox, limits) {
        rootBox.arrange_children(limits);
    }

    control(rootBox, limits) {
        if (!this._pointer.going) {
            return;
        }

        if (limits.highlight) {
            // Highlight mode.

            const path = [];

            // Select a target to which the move will be applied.  
            // Target is the box at the right-hand edge of the window and at the
            // same height as the pointer.  
            // Subtract one from the limit because boxes extend exactly to the
            // edge.
            const target = rootBox.holder(
                limits.right - 1, this._pointer.rawY, path);
            if (target === null) {
                // If the pointer is outside even the root box, apply the move
                // to the root box anyway.
                path[0] = -1;
            }

            // if (target === null) {
            //         console.log("Target null.");
            // }
            // else {
            //     console.log(
            //         `Target "${target.message}"`, path,
            //         target.left, target.right, target.top, target.bottom
            //     );    
            // }

            rootBox.apply_move(
                0 - this._pointer.x, this._pointer.y, path, limits);
        }
        else {
            // Original mode.

            // Solve left position and height, based on the pointer X position.
            const {
                left, height, target
            } = rootBox.solve_x_move(0 - this._pointer.x, limits);
            // if (!Object.is(rootBox, target)) {
            //     console.log('Solver target', target.message);
            // }
            
            // Set the width, simple.
            rootBox.set_dimensions(undefined, limits.width - left);
            
            // Zoom to the solved height and left position.
            rootBox.zoom_to_height(height, left, limits)

            // Increment the middle, based on the pointer Y position, and cascade to
            // all child boxes.
            rootBox.adjust_dimensions(undefined, this._pointer.y, true);
        }
    }        

}

// See https://en.wikipedia.org/wiki/Web_colors

ControllerPointer.unsetColour = "LightSlateGray";

ControllerPointer.sequenceColours = [
    "LightBlue", "SkyBlue", "LightGreen", "PaleGreen"
];

ControllerPointer.groupColours = {
    "capital": "Yellow",
    "small": "DeepSkyBlue",
    "numeral": "LightCoral",
    "punctuation": "LimeGreen",
    "space": "LightGray"
}

// TOTH:
// https://ux.stackexchange.com/questions/91255/how-can-i-best-display-a-blank-space-character
ControllerPointer.displayTextMap = [
    [" ", 0x23b5], // Space mapped to under-bracket.
    ["\n", 0xb6]   // Newline mapped to pilcrow.
];
ControllerPointer.displayTextLeft = ControllerPointer.displayTextMap.map(
    pair => pair[0].codePointAt(0));
