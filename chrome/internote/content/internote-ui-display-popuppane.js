// Internote Extension
// Note Display System - Single Popup Pane Implementation
// Copyright (C) 2010 Matthew Tuck
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
// This is the Display UI, responsible for displaying the notes within the browser.

internoteWindowGlobal_e3631030_7c02_11da_a72b_0800200c9a66.displayUIPopupPane =
{

popupPanel:     null,
innerContainer: null,
offset: [0, 0],
autoFocusNote:  null,

initConnections: function(windowGlobal)
{
    this.prefs   = windowGlobal.sharedGlobal.prefs;
    this.utils   = windowGlobal.sharedGlobal.utils;
    
    this.noteUI  = windowGlobal.noteUI;
},

init: function(getViewportDimsFunc)
{
    this.isPanelShown   = false;
    this.isPanelCreated = false;
    
    this.getViewportDimsFunc = getViewportDimsFunc;
},

supportsTranslucency: function()
{
    return this.utils.supportsTranslucentPopups();
},

setBrowser: function(browser)
{
    this.browser = browser;
},

setUINotes: function(allUINotes, uiNoteLookup)
{
    this.allUINotes   = allUINotes;
    this.uiNoteLookup = uiNoteLookup;
},

tearDown: function()
{
    //dump("internoteDisplayUI.tearDown\n");
    
    if (this.popupPanel != null)
    {
        this.popupPanel.hidePopup();
        this.popupPanel.parentNode.removeChild(this.popupPanel);
        
        this.popupPanel = null;
        this.innerContainer = null;
    }
    
    this.isPanelCreated = false;
    this.isPanelShown   = false;
},

doesNoteExist: function(noteNum)
{
    return document.getElementById("internote-note" + noteNum) != null;
},

addNote: function(uiNote, pos, dims)
{
    //dump("internoteDisplayUI.addNote\n");
    
    this.utils.assertError(uiNote != null, "Null UINote.", uiNote);
    this.utils.assertError(this.utils.isCoordPair(pos),        "Bad pos on viewport.",  pos );
    this.utils.assertError(this.utils.isNonNegCoordPair(dims), "Bad dims on viewport.", dims);
    
    this.noteUI.addFocusListener(uiNote, this.utils.bind(this, this.onNoteFocused));
    
    var containerBeingCreated = (this.innerContainer == null);
    if (containerBeingCreated)
    {
        this.createInsertionContainer();
    }
    
    this.adjustNote(uiNote, pos, dims);
    
    this.addNoteToInnerContainer(uiNote);
    
    if (!containerBeingCreated)
    {
        this.noteUI.noteShown(uiNote);
    }
},

addNoteToInnerContainer: function(uiNote)
{
    for (var i = 0; i < this.innerContainer.childNodes.length; i++)
    {
        var noteNum = this.utils.getNoteNum(this.innerContainer.childNodes[i]);
        var otherUINote = this.uiNoteLookup[noteNum];
        if (uiNote.note.zIndex <= otherUINote.note.zIndex)
        {
            var elt = this.innerContainer.insertBefore(uiNote.noteElt, this.innerContainer.childNodes[i]);
            return;
        }
    }
    
    this.innerContainer.appendChild(uiNote.noteElt);
},

removeNote: function(uiNote)
{
    this.innerContainer.removeChild(uiNote.noteElt);
    
    if (this.innerContainer.childNodes.length == 0)
    {
        this.tearDown();
    }
},

raiseNote: function(uiNote)
{
    // XXX This should check the note has the biggest Z-order.
    if (uiNote.noteElt != this.innerContainer.lastChild)
    {
        var pos  = this.getScreenPosition(uiNote);
        var dims = this.noteUI.getDims(uiNote);
        
        var isFocused = this.noteUI.isFocused(uiNote);
        
        try
        {
            var selection = [uiNote.textArea.selectionStart, uiNote.textArea.selectionEnd];
        }
        catch (ex)
        {
            if (ex.name == "NS_ERROR_FAILURE")
            {
                // This will happen if you try to store the selection for a minimized note,
                // which can happen during the restore process.  We should continue and skip it.
                // I think this is tricky to detect otherwise, I think because there's no
                // guaranteed order between raising and restoring.
                var selection = null;
            }
            else
            {
                throw ex;
            }
        }
        
        this.removeNote(uiNote);
        this.addNote(uiNote, pos, dims);
        
        // This delay seems necessary to get the field to focus if we raised the note
        // as a result of tabbing between notes.
        this.utils.createTimeout(this.utils.bind(this, function() {
            // We need to focus and reselect explicitly because any focus may be lost when we just did the raiseNote because
            // it removes the note from and readds it to the DOM.  This isn't entirely desirable given it may affect
            // the focus in other windows but it seems to be the best solution as long as the notes are in a stack.
            if (isFocused)
            {
                //dump("  Refocusing.\n");
                this.focusNote(uiNote);
            }
            
            if (selection != null)
            {
                [uiNote.textArea.selectionStart, uiNote.textArea.selectionEnd] = selection;
            }
        }), 0);
    }
},

// NoteUI's focusNote method can only be called if the popup panel is already shown,
// whereas you can call this beforehand and it will handle matters.
// It must be called after createInsertionContainer however.
focusNote: function(uiNote)
{
    //dump("displayUI.focusNote\n");
    
    if (this.isPanelShown)
    {
        // The panel is already on-screen, just focus the new note.
        this.noteUI.focusNote(uiNote);
    }
    else
    {
        // The panel is not on-screen, but it should be coming because of the previous call
        // to createInsertionContainer.  If this is the first note,set it for later autofocus.
        // If it's a later note, make this the new autofocus note.
        this.autoFocusNote = uiNote;
    }
},

onNoteFocused: function()
{
    //dump("internoteDisplayUI.onNoteFocused\n");
    
    try
    {
        this.periodicCheck();
    }
    catch (ex)
    {
        this.utils.handleException("Exception caught when handling focus of note.", ex);
    }
},

// If a note suddenly becomes focused the innerContainer can be unexpectedly scrolled,
// resulting in incorrect coordinates.  This happens when you use the tab key between notes,
// for example. We need to adjust the underlying document's scrollbars in this case.
periodicCheck: function()
{
    //dump("internoteDisplayUI.periodicCheck\n");
    
    if (this.innerContainer != null)
    {
        if (this.innerContainer.scrollLeft != 0 || this.innerContainer.scrollTop != 0)
        {
            //dump("  Detected focus problem.\n");
            var contentWin = this.browser.contentWindow;
            var EXTRA_MOVEMENT = 20; // A little bit extra to try to get the whole note on.
            
            var xMovement = this.innerContainer.scrollLeft + this.utils.sgn(this.innerContainer.scrollLeft) * EXTRA_MOVEMENT;
            var yMovement = this.innerContainer.scrollTop  + this.utils.sgn(this.innerContainer.scrollTop ) * EXTRA_MOVEMENT;
            
            this.innerContainer.scrollLeft = 0;
            this.innerContainer.scrollTop = 0;
            
            //dump("  Movement = " + xMovement + " " + yMovement + "\n");
            
            // Move the underlying scroll window to try to get this note on.  It should trigger a
            // reposition of all notes, just in case.
            contentWin.scrollBy(xMovement, yMovement);
        }
    }
},

// A callback for when the popup panel appears.
popupPanelShown: function()
{
    //dump("internoteDisplayUI.popupPanelShown\n");
    
    try
    {
        if (this.autoFocusNote != null)
        {
            //dump("  AutoFocusing ...\n");
            
            this.noteUI.focusNote(this.autoFocusNote);
            this.autoFocusNote = null;
        }
        
        this.isPanelShown = true;
        
        for (var i = 0; i < this.allUINotes.length; i++)
        {
            var uiNote = this.allUINotes[i];
            this.noteUI.noteShown(uiNote);
        }
    }
    catch (ex)
    {
        this.utils.handleException("Exception caught when popup panel shown.", ex);
    }
},

createInsertionContainer: function()
{
    //dump("internoteDisplayUI.createInsertionContainer\n");
    
    this.utils.assertError(this.innerContainer == null, "Inner container already exists");
    
    //dump("  Creating new popup & container.\n");
    
    this.innerContainer = document.createElement("stack");
    this.innerContainer.id = "internote-displayinnercontainer";
    this.innerContainer.style.overflow = "hidden";
    this.innerContainer.style.backgroundColor = "transparent";
    //this.innerContainer.style.backgroundColor = "rgba(255, 0, 0, 0.1)"
    
    this.popupPanel = this.utils.createShiftingPanel(document, "pane", this.innerContainer);
    
    this.utils.addBoundDOMEventListener(this.popupPanel, "popupshown",   this, "popupPanelShown",   false);
    
    this.isPanelCreated = true;
    this.positionPane();
    
    this.utils.assertError(document.getElementById("internote-popuppane") != null, "Can't find display popup.");
},

activateDebugFunction: function()
{
    //dump("internoteDisplayUI.activateDebugFunction\n");
    
    if (this.innerContainer == null)
    {
        this.createInsertionContainer();
    }
    
    this.innerContainer.style.backgroundColor =
        (this.innerContainer.style.backgroundColor == "transparent") ? "rgba(255, 0, 0, 0.1)" : "transparent";
},

// We need to change the pane dimensions if the viewport dimensions change.  Also
// if popups are positioned partially offscreen, they will get moved on-screen, which
// would be inappropriate.  We shrink the popup pane appropriately to avoid this.
// Also on Windows at least, popups on windows that get minimized and then restored,
// get set to state "closed" once the window is restored, but still appear unanchored
// at the wrong position and unmodifiable.  So we hide and open the popup as minimized.
positionPane: function()
{
    //dump("internoteDisplayUI.positionPane\n");
    
    var isMinimized = this.utils.isWindowMinimized(window);
    
    if (this.isPanelCreated)
    {
        if (isMinimized)
        {
            this.popupPanel.hidePopup();
        }
        else
        {
            var viewportDims = this.getViewportDimsFunc();
            
            this.utils.assertError(this.utils.isNonNegCoordPair(viewportDims), "Invalid dims in positionPane.", viewportDims);
            
            var viewportPos  = this.utils.getScreenPos(this.browser.boxObject);
            var viewportRect = this.utils.makeRectFromDims(viewportPos, viewportDims);
            
            //var screenRect = this.utils.getPopupScreenRect(this.browser);
            //var overlapRect = this.utils.getRectIntersection(screenRect, viewportRect);
            
            var overlapRect = this.utils.restrictRectToScreen(window, this.browser, viewportRect);
            var newOffset = this.utils.coordPairSubtract(overlapRect.topLeft, viewportRect.topLeft);
            
            //dump("  viewportPos  = " + this.utils.compactDumpString(viewportPos) + "\n");
            //dump("  viewportRect = " + viewportRect.toString() + "\n");
            //dump("  screenRect   = " + screenRect.toString() + "\n");
            //dump("  overlapRect  = " + overlapRect.toString() + "\n");
            //dump("  newOffset    = " + this.utils.compactDumpString(newOffset) + "\n\n\n");
            
            // The inner container can be to the top or left of the outer container, and so is smaller,
            // if we need to cut off the left or top of the popup panel.
            this.utils.fixDOMEltDims(this.innerContainer.parentNode, overlapRect.dims);
            this.utils.fixDOMEltDims(this.innerContainer, viewportRect.dims);
            
            if (isMinimized || this.popupPanel.state == "closed")
            {
                this.popupPanel.openPopup(this.browser, "overlap", newOffset[0], newOffset[1], false, false);
            }
            else if (!this.utils.areArraysEqual(this.offset, newOffset))
            {
                this.utils.setPos(this.innerContainer, this.utils.coordPairMultiply(-1, newOffset));
                this.offset = newOffset;
                
                this.popupPanel.hidePopup();
                this.popupPanel.openPopup(this.browser, "overlap", newOffset[0], newOffset[1], false, false);
            }
        }
    }
},

scrollToNote: function(uiNote)
{
    var currNoteRect = this.utils.makeRectFromDims(uiNote.note.getPos(), uiNote.note.getDims());
    this.utils.scrollToShowRect(window, this.browser, currNoteRect);
    
    this.focusNote(uiNote);
    this.raiseNote(uiNote);
},

handleChangedAspects: function(posFunc, viewportResized, viewportMoved, scrolled, pageResized)
{
    //dump("internoteDisplayUI.handleChangedAspects\n");
    
    if ((viewportResized || viewportMoved) && this.popupPanel != null)
    {
        this.positionPane();
    }
    
    if (scrolled || viewportResized || pageResized)
    {
        this.adjustAllNotes(posFunc);
    }
},

adjustAllNotes: function(getUpdatedPosFunc)
{
    for (var i = 0; i < this.allUINotes.length; i++)
    {
        var uiNote = this.allUINotes[i];
        var updatedPos = (getUpdatedPosFunc == null) ? null : getUpdatedPosFunc(uiNote);
        
        this.adjustNote(uiNote, updatedPos, null);
    }
},

getScreenPosition: function(uiNote)
{
    return this.utils.getPos(uiNote.noteElt);
},

flipStart: function(uiNote)
{
    this.flipStartPos = this.getScreenPosition(uiNote);
},

flipStep: function(uiNote, offsetX)
{
    this.adjustNote(uiNote, [this.flipStartPos[0] + offsetX, this.flipStartPos[1]], null);
},

adjustNote: function(uiNote, newPosOnViewport, newDims)
{
    //dump("internoteDisplayUI.adjustNote " + this.utils.arrayToString(newPosOnViewport) + " " +
    //     this.utils.arrayToString(newDims) + "\n");
    
    this.utils.assertError(uiNote != null, "Null UINote.", uiNote);
    this.utils.assertError(newPosOnViewport == null || this.utils.isCoordPair(newPosOnViewport), "Bad pos on viewport.",  newPosOnViewport);
    this.utils.assertError(newDims          == null || this.utils.isNonNegCoordPair(newDims),    "Bad dims on viewport.", newDims         );
    
    if (newPosOnViewport != null)
    {
        this.utils.assertError(this.utils.isPair(newPosOnViewport), "Invalid pos (1).", newPosOnViewport);
        this.utils.assertError(this.utils.isOptionalFiniteNumber(newPosOnViewport[0]), "Invalid pos (2).", newPosOnViewport[0]);
        this.utils.assertError(this.utils.isOptionalFiniteNumber(newPosOnViewport[1]), "Invalid pos (3).", newPosOnViewport[1]);

        this.utils.setPos(uiNote.noteElt, newPosOnViewport);
    }
},

moveStart: function(uiNote)
{
},

moveEnd: function(uiNote)
{
},

};

internoteWindowGlobal_e3631030_7c02_11da_a72b_0800200c9a66.displayUIPopupPane.initConnections(internoteWindowGlobal_e3631030_7c02_11da_a72b_0800200c9a66);
