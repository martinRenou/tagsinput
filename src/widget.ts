// Copyright (c) QuantStack
// Distributed under the terms of the Modified BSD License.

const d3Color = require('d3-color');

import {
    DOMWidgetModel, DOMWidgetView, Dict
} from '@jupyter-widgets/base';

import * as _ from 'underscore';

import {
  MODULE_NAME, MODULE_VERSION
} from './version';

// Import CSS
import '../css/tagsinput.css'

/**
 * Returns a new string after removing any leading and trailing whitespaces.
 * The original string is left unchanged.
 */
function trim(value: string) : string {
    return value.replace(/^\s+|\s+$/g, '');
}

/**
 * Clamp a number between min and max and return the result.
 */
function clamp(value: number, min: number, max: number) : number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Selection class which keeps track on selected indices.
 */
class Selection {
    constructor(start: number, dx: number, max: number) {
        this.start = start;
        this.dx = dx;
        this.max = max;
    }

    /**
     * Check if a given index is currently selected.
     */
    isSelected(index: number) : boolean {
        let min: number;
        let max: number;
        if (this.dx >= 0) {
            min = this.start;
            max = this.start + this.dx;
        } else {
            min = this.start + this.dx;
            max = this.start;
        }
        return min <= index && index < max;
    }

    /**
     * Update selection
     */
    updateSelection(dx: number) : void {
        this.dx += dx;

        if (this.start + this.dx > this.max) {
            this.dx = this.max - this.start;
        }
        if (this.start + this.dx < 0) {
            this.dx = - this.start;
        }
    }

    private start: number;
    private dx: number;
    private max: number;
}

class TagsInputBaseModel extends DOMWidgetModel {
    defaults() {
        return _.extend(super.defaults(), {
            value: [],
            allow_duplicates: true,
            _model_module: TagsInputBaseModel.model_module,
            _model_module_version: TagsInputBaseModel.model_module_version,
            _view_module: TagsInputBaseModel.view_module,
            _view_module_version: TagsInputBaseModel.view_module_version,
        });
    }

    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static view_module = MODULE_NAME;
    static view_module_version = MODULE_VERSION;
}

abstract class TagsInputBaseView extends DOMWidgetView {
    /**
     * Called when view is rendered.
     */
    render() {
        super.render();
        this.el.classList.add('jupyter-widgets');
        this.el.classList.add('jupyter-widget-tagsinput');

        this.taginput = document.createElement('input');
        this.taginput.classList.add('jupyter-widget-tag');
        this.taginput.classList.add('jupyter-widget-taginput');

        this.el.onclick = this.focus.bind(this);

        this.taginput.onchange = this.handleValueAdded.bind(this);
        this.taginput.oninput = this.resizeInput.bind(this);
        this.taginput.onkeydown = this.handleKeyEvent.bind(this);
        this.taginput.onblur = this.loseFocus.bind(this);
        this.resizeInput();

        this.inputIndex = this.model.get('value').length;

        this.selection = null;
        this.preventLoosingFocus = false;

        this.update();
    }

    /**
     * Update the contents of this view
     *
     * Called when the model is changed. The model may have been
     * changed by another view or by a state update from the back-end.
     */
    update() {
        // Prevent hiding the input element and clearing the selection when updating everything
        this.preventLoosingFocus = true;

        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
        this.tags = [];

        const value: Array<any> = this.model.get('value');
        for (const idx in value) {
            const index = parseInt(idx);

            const tag = this.createTag(value[index], index, this.selection != null && this.selection.isSelected(index));

            this.tags.push(tag);
            this.el.appendChild(tag);
        }

        this.el.insertBefore(this.taginput, this.el.children[this.inputIndex]);

        this.preventLoosingFocus = false;

        return super.update();
    }

    /**
     * Update the tags, called when the selection has changed and we need to update the tags CSS
     */
    updateTags() {
        const value: Array<any> = this.model.get('value');

        for (const idx in this.tags) {
            const index = parseInt(idx);

            this.updateTag(this.tags[index], value[index], index, this.selection != null && this.selection.isSelected(index));
        }
    }

    /**
     * Handle a new value is added
     */
    handleValueAdded(event: Event) {
        const value: Array<any> = this.model.get('value');
        const newTagValue = trim(this.taginput.value);

        if (newTagValue == '') {
            return;
        }

        if (!this.isValidTag(newTagValue)) {
            // Do nothing for now, maybe show a proper error message?
            return;
        }

        if (!this.model.get('allow_duplicates') && value.includes(newTagValue)) {
            // Do nothing for now, maybe add an animation to highlight the tag?
            return;
        }

        // Clearing the current selection before setting the new value
        this.selection = null;

        // Making a copy so that backbone sees the change, and insert the new tag
        const newValue = [...value];
        newValue.splice(this.inputIndex, 0, newTagValue);

        this.inputIndex++;

        this.model.set('value', newValue);
        this.model.save_changes();

        // Clear the input and keep focus on it allowing the user to add more tags
        this.taginput.value = '';
        this.resizeInput();
        this.focus();
    }

    /**
     * Resize the input element
     */
    resizeInput() {
        let size = this.taginput.value.length;
        // If size is set to 0, the input gets too wide
        if (size == 0) {
            size = 1;
        }
        this.taginput.setAttribute('size', String(size));
    }

    /**
     * Handle key events on the input element
     */
    handleKeyEvent(event: KeyboardEvent) {
        const valueLength = this.model.get('value').length;

        // Do nothing if the user is typing something
        if (this.taginput.value.length) {
            return;
        }

        const currentElement: number = this.inputIndex;
        switch (event.key) {
            case 'ArrowLeft':
                if (event.ctrlKey && event.shiftKey) {
                    this.select(currentElement, -currentElement);
                }
                if (!event.ctrlKey && event.shiftKey) {
                    this.select(currentElement, -1);
                }

                if (event.ctrlKey) {
                    this.inputIndex = 0;
                } else {
                    this.inputIndex--;
                }
                break;
            case 'ArrowRight':
                if (event.ctrlKey && event.shiftKey) {
                    this.select(currentElement, valueLength - currentElement);
                }
                if (!event.ctrlKey && event.shiftKey) {
                    this.select(currentElement, 1);
                }

                if (event.ctrlKey) {
                    this.inputIndex = valueLength;
                } else {
                    this.inputIndex++;
                }
                break;
            case 'Backspace':
                if (this.selection) {
                    this.removeSelectedTags();
                } else {
                    this.removeTag(this.inputIndex - 1);
                }
                break;
            case 'Delete':
                if (this.selection) {
                    this.removeSelectedTags();
                } else {
                    this.removeTag(this.inputIndex);
                }
                break;
            default:
                // Do nothing by default
                return;
                break;
        }

        // Reset selection is shift key is not pressed
        if (!event.shiftKey) {
            this.selection = null;
        }

        this.inputIndex = clamp(this.inputIndex, 0, valueLength);

        this.update();
        this.focus();
    }

    /**
     * Select tags from `start` to `start + dx` not included.
     */
    select(start: number, dx: number) {
        const valueLength = this.model.get('value').length;

        if (!this.selection) {
            this.selection = new Selection(start, dx, valueLength);
        } else {
            this.selection.updateSelection(dx);
        }
    }

    /**
     * Remove all the selected tags.
     */
    removeSelectedTags() {
        const value: Array<string> = [...this.model.get('value')];
        const valueLength = value.length;

        // It is simpler to remove from right to left
        for (let idx = valueLength - 1; idx >= 0; idx--) {
            if (this.selection != null && this.selection.isSelected(idx)) {
                value.splice(idx, 1);

                // Move the input to the left if we remove a tag that is before the input
                if (idx < this.inputIndex) {
                    this.inputIndex--;
                }
            }
        }

        this.model.set('value', value);
        this.model.save_changes();
    }

    /**
     * Remove a tag given its index in the list
     */
    removeTag(tagIndex: number) {
        const value: Array<string> = [...this.model.get('value')];

        value.splice(tagIndex, 1);

        // Move the input to the left if we remove a tag that is before the input
        if (tagIndex < this.inputIndex) {
            this.inputIndex--;
        }

        this.model.set('value', value);
        this.model.save_changes();
    }

    /**
     * Focus on the input element
     */
    focus() {
        this.taginput.style.display = 'inline-block';
        this.taginput.focus();
    }

    /**
     * Lose focus on the input element
     */
    loseFocus() {
        if (this.preventLoosingFocus) {
            return;
        }

        this.taginput.style.display = 'none';
        this.selection = null;
        this.updateTags();
    }

    /**
     * The default tag name.
     *
     * #### Notes
     * This is a read-only attribute.
     */
    get tagName() {
        // We can't make this an attribute with a default value
        // since it would be set after it is needed in the
        // constructor.
        return 'div';
    }

    /**
     * Validate an input tag typed by the user. This should be overridden in subclasses.
     */
    isValidTag(value: string) : boolean {
        return true;
    }

    abstract createTag(value: any, index: number, selected: boolean) : HTMLElement;
    abstract updateTag(tag: HTMLElement, value: any, index: number, selected: boolean) : void;

    el: HTMLDivElement;
    taginput: HTMLInputElement;
    tags: HTMLElement[];
    inputIndex: number;
    selection: null | Selection
    preventLoosingFocus: boolean;

    model: TagsInputBaseModel;
}

export
class TagsInputModel extends TagsInputBaseModel {
    defaults() {
        return _.extend(super.defaults(), {
            value: [],
            tag_style: '',
            _view_name: 'TagsInputView',
            _model_name: 'TagsInputModel',
        });
    }
}

export
class TagsInputView extends TagsInputBaseView {
    /**
     * Create the string tag
     */
    createTag(value: string, index: number, selected: boolean) : HTMLDivElement {
        const tag = document.createElement('div');
        const style: string = this.model.get('tag_style');

        tag.classList.add('jupyter-widget-tag');
        tag.classList.add(TagsInputView.class_map[style]);

        if (selected) {
            tag.classList.add('mod-active');
        }

        tag.appendChild(document.createTextNode(value));

        const i = document.createElement('i');
        i.classList.add('fa');
        i.classList.add('fa-times');
        i.classList.add('jupyter-widget-tag-close');
        tag.appendChild(i);

        i.onmousedown = ((index: number) => {
            return () => {
                this.removeTag(index);
                this.loseFocus();
            };
        })(index);

        return tag;
    }

    /**
     * Update a given tag
     */
    updateTag(tag: HTMLDivElement, value: any, index: number, selected: boolean) : void {
        if (selected) {
            tag.classList.add('mod-active');
        } else {
            tag.classList.remove('mod-active');
        }
    }

    model: TagsInputModel;

    static class_map: Dict<string> = {
        primary: 'mod-primary',
        success: 'mod-success',
        info: 'mod-info',
        warning: 'mod-warning',
        danger: 'mod-danger'
    };
}

export
class ColorsInputModel extends TagsInputBaseModel {
    defaults() {
        return _.extend(super.defaults(), {
            value: [],
            _view_name: 'ColorsInputView',
            _model_name: 'ColorsInputModel',
        });
    }
}

export
class ColorsInputView extends TagsInputBaseView {
    /**
     * Create the Color tag
     */
    createTag(value: string, index: number, selected: boolean) : HTMLDivElement {
        const tag = document.createElement('div');
        const color = value;
        const darkerColor: string = d3Color.color(value).darker().toString();

        tag.classList.add('jupyter-widget-tag');
        tag.classList.add('jupyter-widget-colortag');

        if (!selected) {
            tag.style.backgroundColor = color;
        } else {
            tag.classList.add('mod-active');
            tag.style.backgroundColor = darkerColor;
        }

        const i = document.createElement('i');
        i.classList.add('fa');
        i.classList.add('fa-times');
        i.classList.add('jupyter-widget-tag-close');
        tag.appendChild(i);

        i.onmousedown = ((index: number) => {
            return () => {
                this.removeTag(index);
                this.loseFocus();
            };
        })(index);

        return tag;
    }

    /**
     * Update a given tag
     */
    updateTag(tag: HTMLDivElement, value: any, index: number, selected: boolean) : void {
        const color = value;
        const darkerColor: string = d3Color.color(value).darker().toString();

        if (!selected) {
            tag.classList.remove('mod-active');
            tag.style.backgroundColor = color;
        } else {
            tag.classList.add('mod-active');
            tag.style.backgroundColor = darkerColor;
        }
    }

    /**
     * Validate a color tag typed by the user.
     */
    isValidTag(value: string) : boolean {
        return d3Color.color(value) !== null;
    }

    model: ColorsInputModel;
}
