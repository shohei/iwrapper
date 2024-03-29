// Internote Extension
// Drag Handler
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

// This is used for handling drags for movement and resizing.

// To use, you simply create a drag handler, overwrite onDragMouseMoved and onDragFinished,
// and call dragStarted().  The handler will distingush a drag (moved an adequate distance)
// from a click (didn't), as well as handling the ESC key, both through parameters to onDragFinished.

internoteSharedGlobal_e3631030_7c02_11da_a72b_0800200c9a66.utils.DragHandler =
function DragHandler(utils, chromeDoc, data)
{
    this.utils = utils;
    this.chromeDoc = chromeDoc;
    this.data  = data;
};

internoteSharedGlobal_e3631030_7c02_11da_a72b_0800200c9a66.utils.DragHandler.prototype =
{

// Overwrite these as appropriate.
onDragMouseMoved: function(event, offset, data) {},
onDragFinished:   function(wasCompleted, wasDrag, offset, data) {},

registerHandlers: function()
{
    //dump("internoteUtilities.DragHandler.registerHandlers\n");
    
    this.utils.addBoundDOMEventListener(this.chromeDoc, "keypress",  this, "dragKeyPressed",     false);
    this.utils.addBoundDOMEventListener(this.chromeDoc, "mousemove", this, "dragMouseMoved",     false);
    this.utils.addBoundDOMEventListener(this.chromeDoc, "mouseup",   this, "dragButtonReleased", false);
},

deregisterHandlers: function()
{
    //dump("internoteUtilities.DragHandler.deregisterHandlers\n");
    
    this.utils.removeBoundDOMEventListener(this.chromeDoc, "keypress",  this, "dragKeyPressed"    , false);
    this.utils.removeBoundDOMEventListener(this.chromeDoc, "mousemove", this, "dragMouseMoved"    , false);
    this.utils.removeBoundDOMEventListener(this.chromeDoc, "mouseup",   this, "dragButtonReleased", false);
},

isAdequateDrag: function(offset)
{
    const DRAG_MIN_DISTANCE = 3;
    var pointerMovement = this.utils.coordPairDistance(offset);
    return DRAG_MIN_DISTANCE <= pointerMovement;
},

dragStarted: function(event)
{
    //dump("internoteUtilities.DragHandler.dragStarted\n");
    
    this.pointerInitialPos = [event.screenX, event.screenY];
    this.registerHandlers();
},

dragFinished: function(wasCompleted, wasDrag)
{
    //dump("internoteUtilities.DragHandler.dragFinished\n");
 //Send http request for the heroku server application
// iwrapper2012.heroku.com
    function sendHeroku(note){
    var server_url = "http://iwrapper2012.heroku.com/notes/add.json?";
  var user = "noName";
  var comment = note.text;
  var left = note.left;
  var top = note.top;
  var width = note.width;
  var height = note.height;
  var url = note.url;
  var backcolor = note.backColor;
  var key = note.key; // ページごとの固有ID
  
  var param = {
    user : user,
    comment : comment,
    left : left,
    top : top,
    width : width,
    height : height,
    url : url,
    backcolor : backcolor,
    key : key,
    callback : '?',
  };
  $.getJSON(server_url, param, function(data){console.log(data);});
};

  note = this.data.note;
  sendHeroku(note); 
       
    try
    {
        this.onDragFinished(wasCompleted, wasDrag, this.pointerOffset, this.data);
        this.hasBeenDragMovement = false;
        this.deregisterHandlers();
    }
    catch (ex)
    {
        this.dragFailure("Exception when drag finished.", ex);
    }
},

// Lots of catches here to try to do as much as we can in case of failure.
dragFailure: function(msg, ex)
{
    this.hasBeenDragMovement = false;
    
    try
    {
        this.utils.handleException(msg, ex);
    }
    catch (ex2)
    {
        /* Nothing we can do. */
    }
    
    try
    {
        this.deregisterHandlers();
    }
    catch (ex2)
    {
        try
        {
            this.utils.handleException("Failed to deregister handlers after exception.", ex2);
        }
        catch (ex3) { /* Nothing we can do. */ }
    }
    
    try
    {
        this.onDragFinished(false, null, null, this.data);
    }
    catch (ex2)
    {
        try
        {
            this.utils.handleException("Exception caught from onDragFinished after exception.", ex2);
        }
        catch (ex3) { /* Nothing we can do. */ }
    }
},

dragKeyPressed: function(ev)
{
    //dump("internoteUtilities.DragHandler.dragKeyPressed\n");
    
    try
    {
        if (ev.keyCode == ev.DOM_VK_ESCAPE)
        {
            this.dragFinished(false, null);
            ev.stopPropagation();
            ev.preventDefault();
        }
    }
    catch (ex)
    {
        this.dragFailure("Exception caught while pressing key during drag.", ex);
    }
},

dragMouseMoved: function(event)
{
    //dump("internoteUtilities.DragHandler.dragMouseMoved\n");
    
    try
    {
        var pointerCurrentPos = [event.screenX, event.screenY];
        this.pointerOffset = this.utils.coordPairSubtract(pointerCurrentPos, this.pointerInitialPos);
        
        if (!this.hasBeenDragMovement && this.isAdequateDrag(this.pointerOffset))
        {
            //dump("  Has been movement.\n");
            this.hasBeenDragMovement = true;
        }
        
        if (this.hasBeenDragMovement)
        {
            this.onDragMouseMoved(event, this.pointerOffset, this.data);
        }
    }
    catch (ex)
    {
        this.dragFailure("Exception caught while moving mouse during drag.", ex);
    }
},

dragButtonReleased: function(event)
{
    //dump("internoteUtilities.DragHandler.dragButtonReleased\n");
    
    try
    {
        this.dragFinished(true, this.hasBeenDragMovement);
        this.deregisterHandlers();
    }
    catch (ex)
    {
        this.dragFailure("Exception caught while releasing button during drag.", ex);
    }
},

};
