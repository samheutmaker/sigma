/**
 * Undo/Redo History Manager
 */

class HistoryManager {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.undoStack = [];
        this.redoStack = [];
        this.isApplying = false;
    }

    /**
     * Record a state change
     */
    push(state) {
        if (this.isApplying) return;

        // Clear redo stack on new action
        this.redoStack = [];

        // Add to undo stack
        this.undoStack.push(Utils.deepClone(state));

        // Limit stack size
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
    }

    /**
     * Undo the last action
     */
    undo(currentState) {
        if (this.undoStack.length === 0) return null;

        // Save current state to redo stack
        this.redoStack.push(Utils.deepClone(currentState));

        // Pop and return previous state
        return this.undoStack.pop();
    }

    /**
     * Redo the last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return null;

        return this.redoStack.pop();
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Begin applying a history state (prevents recording)
     */
    beginApply() {
        this.isApplying = true;
    }

    /**
     * End applying a history state
     */
    endApply() {
        this.isApplying = false;
    }

    /**
     * Get undo stack size
     */
    get undoCount() {
        return this.undoStack.length;
    }

    /**
     * Get redo stack size
     */
    get redoCount() {
        return this.redoStack.length;
    }
}

window.HistoryManager = HistoryManager;
