import React from 'react';
import { Editor, EditorState } from 'draft-js';

export function normalizeSelectedIndex(selectedIndex, max) {
  let index = selectedIndex % max;
  if (index < 0) {
    index += max;
  }
  return index;
}

export default class DraftTypeahead extends Editor {
  constructor(props) {
    super(props);
    this.typeaheadState = null;
  }

  hasEntityAtSelection() {
    const { editorState } = this.props;

    const selection = editorState.getSelection();
    if (!selection.getHasFocus()) {
      return false;
    }

    const contentState = editorState.getCurrentContent();
    const block = contentState.getBlockForKey(selection.getStartKey());
    return !!block.getEntityAt(selection.getStartOffset() - 1);
  }

  getTypeaheadRange() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || this.hasEntityAtSelection()) {
      return null;
    }

    const { token } = this.props;
    const range = selection.getRangeAt(0);
    let text = range.startContainer.textContent;

    // Remove text that appears after the cursor..
    text = text.substring(0, range.startOffset);

    // ..and before the typeahead token.
    const index = text.lastIndexOf(token);
    if (index === -1) {
      return null;
    }
    text = text.substring(index);

    // Do not allow a leading Space
    if (text.substring(token.length, token.length + 1) === ' ') {
      return null;
    }

    return {
      text,
      start: index,
      end: range.startOffset
    };
  }

  getTypeaheadState(invalidate = true) {
    if (!invalidate) {
      return this.typeaheadState;
    }

    const typeaheadRange = this.getTypeaheadRange();
    if (!typeaheadRange) {
      this.typeaheadState = null;
      return null;
    }

    const tempRange = window.getSelection().getRangeAt(0).cloneRange();
    tempRange.setStart(tempRange.startContainer, typeaheadRange.start);

    const rangeRect = tempRange.getBoundingClientRect();
    let [left, top] = [rangeRect.left, rangeRect.bottom];

    this.typeaheadState = {
      left,
      top: top + window.scrollY,
      text: typeaheadRange.text,
      selectedIndex: 0
    };
    return this.typeaheadState;
  }

  onChange = (editorState) => {
    this.props.onChange(editorState);

    // Set typeahead visibility. Wait a frame to ensure that the cursor is
    // updated.
    if (this.props.onTypeaheadChange) {
      window.requestAnimationFrame(() => {
        this.props.onTypeaheadChange(this.getTypeaheadState());
      });
    }
  }

  onEscape = (e) => {
    if (!this.getTypeaheadState(false)) {
      this.props.onEscape && this.props.onEscape(e);
      return;
    }

    e.preventDefault();
    this.typeaheadState = null;

    this.props.onTypeaheadChange && this.props.onTypeaheadChange(null);
  }

  onArrow(e, originalHandler, nudgeAmount) {
    let typeaheadState = this.getTypeaheadState(false);

    if (!typeaheadState) {
      originalHandler && originalHandler(e);
      return;
    }

    e.preventDefault();
    typeaheadState.selectedIndex += nudgeAmount;
    this.typeaheadState = typeaheadState;

    this.props.onTypeaheadChange && this.props.onTypeaheadChange(typeaheadState);
  }

  onUpArrow = (e) => {
    this.onArrow(e, this.props.onUpArrow, -1);
  }

  onDownArrow = (e) => {
    this.onArrow(e, this.props.onDownArrow, 1);
  }

  onSideArrow(nudgeAmount) {
    const { editorState } = this.props;
    const selectionState = editorState.getSelection();
    const newSelectionState = selectionState.merge({
      focusOffset: selectionState.getFocusOffset() + nudgeAmount
    });
    const newEditorState = EditorState.forceSelection(editorState, newSelectionState);
    this.props.onChange(newEditorState);
  }

  onRightArrow = (e) => {
    this.onSideArrow(1);
  }

  onLeftArrow = (e) => {
    this.onSideArrow(-1);
  }

  handleReturn = (e) => {
    if (this.typeaheadState) {
      if (this.props.handleTypeaheadReturn) {
        const selectionState = this.props.editorState.getSelection();
        const entitySelection = selectionState.merge({
          focusOffset: selectionState.getFocusOffset(),
          anchorOffset: selectionState.getFocusOffset() - this.typeaheadState.text.length
        });

        this.props.handleTypeaheadReturn(
          this.typeaheadState.text, this.typeaheadState.selectedIndex, entitySelection
        );

        this.typeaheadState = null;
        this.props.onTypeaheadChange && this.props.onTypeaheadChange(null);
      } else {
        console.error(
          "Warning: A typeahead is showing and return was pressed but `handleTypeaheadReturn` " +
          "isn't implemented."
        );
      }
      return true;
    }
    return false;
  }

  onTab(e) {
    this.handleReturn(e);
    e.preventDefault();
  }

  render() {
    const {
      onChange,
      onEscape, onUpArrow, onDownArrow, onRightArrow, onLeftArrow,
      onTypeaheadChange,
      ...other
    } = this.props;

    return (
      <Editor
        {...other}
        onChange={this.onChange}
        onEscape={this.onEscape}
        onUpArrow={this.onUpArrow}
        onDownArrow={this.onDownArrow}
        onRightArrow={this.onRightArrow}
        onLeftArrow={this.onLeftArrow}
        handleReturn={this.handleReturn}
        onTab={this.onTab}
      />
    );
  }
};
