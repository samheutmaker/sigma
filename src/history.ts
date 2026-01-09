/**
 * Undo/Redo History Manager
 */

import { Utils } from './utils.ts';

export interface HistoryState {
    objects: unknown[];
    selectedIds: string[];
}

export class HistoryManager {
    maxSize: number;
    undoStack: HistoryState[];
    redoStack: HistoryState[];
    isApplying: boolean;

    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
        this.undoStack = [];
        this.redoStack = [];
        this.isApplying = false;
    }

    /**
     * Record a state change
     */
    push(state: HistoryState): void {
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
    undo(currentState: HistoryState): HistoryState | null {
        if (this.undoStack.length === 0) return null;

        // Save current state to redo stack
        this.redoStack.push(Utils.deepClone(currentState));

        // Pop and return previous state
        return this.undoStack.pop() || null;
    }

    /**
     * Redo the last undone action
     */
    redo(): HistoryState | null {
        if (this.redoStack.length === 0) return null;

        return this.redoStack.pop() || null;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /**
     * Clear all history
     */
    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Begin applying a history state (prevents recording)
     */
    beginApply(): void {
        this.isApplying = true;
    }

    /**
     * End applying a history state
     */
    endApply(): void {
        this.isApplying = false;
    }

    /**
     * Get undo stack size
     */
    get undoCount(): number {
        return this.undoStack.length;
    }

    /**
     * Get redo stack size
     */
    get redoCount(): number {
        return this.redoStack.length;
    }
}

export default HistoryManager;
