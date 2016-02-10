define('extensions/adapt-contrib-pageLevelProgress/js/completionCalculations',[],function() {
    
    // Calculate completion of a contentObject
    function calculateCompletion(contentObjectModel) {

        var viewType = contentObjectModel.get('_type'),
            nonAssessmentComponentsTotal = 0,
            nonAssessmentComponentsCompleted = 0,
            assessmentComponentsTotal = 0,
            assessmentComponentsCompleted = 0,
            subProgressCompleted = 0,
            subProgressTotal = 0,
            isComplete = contentObjectModel.get("_isComplete") ? 1 : 0;

        // If it's a page
        if (viewType == 'page') {
            var children = contentObjectModel.findDescendants('components').where({'_isAvailable': true, '_isOptional': false});
            var components = getPageLevelProgressEnabledModels(children);

            var nonAssessmentComponents = getNonAssessmentComponents(components);

            nonAssessmentComponentsTotal = nonAssessmentComponents.length | 0,
            nonAssessmentComponentsCompleted = getComponentsCompleted(nonAssessmentComponents).length;

            var assessmentComponents = getAssessmentComponents(components);

            assessmentComponentsTotal = assessmentComponents.length | 0,
            assessmentComponentsCompleted = getComponentsInteractionCompleted(assessmentComponents).length;

            subProgressCompleted = contentObjectModel.get("_subProgressComplete") || 0;
            subProgressTotal = contentObjectModel.get("_subProgressTotal") || 0;

            //add one point extra for page completion to eliminate incomplete pages and full progress bars
            return {
                "subProgressCompleted": subProgressCompleted,
                "subProgressTotal": subProgressTotal,
                "nonAssessmentCompleted": nonAssessmentComponentsCompleted + isComplete,
                "nonAssessmentTotal": nonAssessmentComponentsTotal + 1,
                "assessmentCompleted": assessmentComponentsCompleted + isComplete,
                "assessmentTotal": assessmentComponentsTotal + 1
            };
        }
        // If it's a sub-menu
        else if (viewType == 'menu') {

            _.each(contentObjectModel.get('_children').models, function(contentObject) {
                var completionObject = calculateCompletion(contentObject);
                subProgressCompleted += contentObjectModel.subProgressCompleted || 0;
                subProgressTotal += contentObjectModel.subProgressTotal || 0;
                nonAssessmentComponentsTotal += completionObject.nonAssessmentTotal;
                nonAssessmentComponentsCompleted += completionObject.nonAssessmentCompleted;
                assessmentComponentsTotal += completionObject.assessmentTotal;
                assessmentComponentsCompleted += completionObject.assessmentCompleted;
            });

            return {
                "subProgressCompleted": subProgressCompleted,
                "subProgressTotal" : subProgressTotal,
                "nonAssessmentCompleted": nonAssessmentComponentsCompleted,
                "nonAssessmentTotal": nonAssessmentComponentsTotal,
                "assessmentCompleted": assessmentComponentsCompleted,
                "assessmentTotal": assessmentComponentsTotal,
            };
        }
    }

    function getNonAssessmentComponents(models) {
        return _.filter(models, function(model) {
            return !model.get('_isPartOfAssessment');
        });
    }

    function getAssessmentComponents(models) {
        return _.filter(models, function(model) {
            return model.get('_isPartOfAssessment');
        });
    }

    function getComponentsCompleted(models) {
        return _.filter(models, function(item) {
            return item.get('_isComplete');
        });
    }

    function getComponentsInteractionCompleted(models) {
        return _.filter(models, function(item) {
            return item.get('_isInteractionComplete');
        });
    }

    //Get only those models who were enabled for pageLevelProgress
    function getPageLevelProgressEnabledModels(models) {
        return _.filter(models, function(model) {
            if (model.get('_pageLevelProgress')) {
                return model.get('_pageLevelProgress')._isEnabled;
            }
        });
    }

    return {
    	calculateCompletion: calculateCompletion,
    	getPageLevelProgressEnabledModels: getPageLevelProgressEnabledModels
    };

});
define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var PageLevelProgressMenuView = Backbone.View.extend({

        className: 'page-level-progress-menu-item',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);

            this.ariaText = '';
            if (Adapt.course.get('_globals')._extensions && Adapt.course.get('_globals')._extensions._pageLevelProgress && Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressMenuBar) {
                this.ariaText = Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressMenuBar + ' ';
            }

            this.render();

            _.defer(_.bind(function() {
                this.updateProgressBar();
            }, this));
        },

        events: {
        },

        render: function() {
            var data = this.model.toJSON();
            _.extend(data, {
                _globals: Adapt.course.get('_globals')
            });
            var template = Handlebars.templates['pageLevelProgressMenu'];

            this.$el.html(template(data));
            return this;
        },

        updateProgressBar: function() {
            if (this.model.get('completedChildrenAsPercentage')) {
                var percentageOfCompleteComponents = this.model.get('completedChildrenAsPercentage');
            } else {
                var percentageOfCompleteComponents = 0;
            }

            // Add percentage of completed components as an aria label attribute
            this.$('.page-level-progress-menu-item-indicator-bar .aria-label').html(this.ariaText + Math.floor(percentageOfCompleteComponents) + '%');

        },

    });

    return PageLevelProgressMenuView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView',['require','coreJS/adapt','backbone'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');

    var PageLevelProgressView = Backbone.View.extend({

        className: 'page-level-progress',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.render();
        },

        events: {
            'click .page-level-progress-item button': 'scrollToPageElement'
        },

        scrollToPageElement: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            var currentComponentSelector = '.' + $(event.currentTarget).attr('data-page-level-progress-id');
            var $currentComponent = $(currentComponentSelector);
            Adapt.once('drawer:closed', function() {
                Adapt.scrollTo($currentComponent, { duration:400 });
            });
            Adapt.trigger('drawer:closeDrawer');
        },

        render: function() {
            var components = this.collection.toJSON();
            var data = {
                components: components,
                _globals: Adapt.course.get('_globals')
            };
            var template = Handlebars.templates['pageLevelProgress'];
            this.$el.html(template(data));
            this.$el.a11y_aria_label(true);
            return this;
        }

    });

    return PageLevelProgressView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView',['require','coreJS/adapt','backbone','./completionCalculations','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');
    var completionCalculations = require('./completionCalculations');

    var PageLevelProgressView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressView');

    var PageLevelProgressNavigationView = Backbone.View.extend({

        tagName: 'button',

        className: 'base page-level-progress-navigation',

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(Adapt, 'router:location', this.updateProgressBar);
            this.listenTo(Adapt, 'pageLevelProgress:update', this.refreshProgressBar);
            this.listenTo(this.collection, 'change:_isInteractionComplete', this.updateProgressBar);
            this.listenTo(this.model, 'change:_isInteractionComplete', this.updateProgressBar);
            this.$el.attr('role', 'button');
            this.ariaText = '';
            
            if (Adapt.course.has('_globals') && Adapt.course.get('_globals')._extensions && Adapt.course.get('_globals')._extensions._pageLevelProgress && Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressIndicatorBar) {
                this.ariaText = Adapt.course.get('_globals')._extensions._pageLevelProgress.pageLevelProgressIndicatorBar +  ' ';
            }
            
            this.render();
            
            _.defer(_.bind(function() {
                this.updateProgressBar();
            }, this));
        },

        events: {
            'click': 'onProgressClicked'
        },

        render: function() {
            var components = this.collection.toJSON();
            var data = {
                components: components,
                _globals: Adapt.course.get('_globals')
            };            

            var template = Handlebars.templates['pageLevelProgressNavigation'];
            $('.navigation-drawer-toggle-button').after(this.$el.html(template(data)));
            return this;
        },
        
        refreshProgressBar: function() {
            var currentPageComponents = this.model.findDescendants('components').where({'_isAvailable': true});
            var enabledProgressComponents = completionCalculations.getPageLevelProgressEnabledModels(currentPageComponents);
            
            this.collection = new Backbone.Collection(enabledProgressComponents);
            this.updateProgressBar();
        },

        updateProgressBar: function() {
            var completionObject = completionCalculations.calculateCompletion(this.model);
            
            //take all assessment, nonassessment and subprogress into percentage
            //this allows the user to see if assessments have been passed, if assessment components can be retaken, and all other component's completion
            
            var completed = completionObject.nonAssessmentCompleted + completionObject.assessmentCompleted + completionObject.subProgressCompleted;
            var total  = completionObject.nonAssessmentTotal + completionObject.assessmentTotal + completionObject.subProgressTotal;

            var percentageComplete = Math.floor((completed / total)*100);


            this.$('.page-level-progress-navigation-bar').css('width', percentageComplete + '%');

            // Add percentage of completed components as an aria label attribute
            this.$el.attr('aria-label', this.ariaText +  percentageComplete + '%');

            // Set percentage of completed components to model attribute to update progress on MenuView
            this.model.set('completedChildrenAsPercentage', percentageComplete);
        },

        onProgressClicked: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            Adapt.drawer.triggerCustomView(new PageLevelProgressView({collection: this.collection}).$el, false);
        }

    });

    return PageLevelProgressNavigationView;

});

define('extensions/adapt-contrib-pageLevelProgress/js/adapt-contrib-pageLevelProgress',['require','coreJS/adapt','backbone','./completionCalculations','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView','extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView'],function(require) {

    var Adapt = require('coreJS/adapt');
    var Backbone = require('backbone');
    var completionCalculations = require('./completionCalculations');

    var PageLevelProgressMenuView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressMenuView');
    var PageLevelProgressNavigationView = require('extensions/adapt-contrib-pageLevelProgress/js/PageLevelProgressNavigationView');

    function setupPageLevelProgress(pageModel, enabledProgressComponents) {

        new PageLevelProgressNavigationView({model: pageModel, collection:  new Backbone.Collection(enabledProgressComponents) });

    }

    // This should add/update progress on menuView
    Adapt.on('menuView:postRender', function(view) {

        if (view.model.get('_id') == Adapt.location._currentId) return;

        // do not proceed until pageLevelProgress enabled on course.json
        if (!Adapt.course.get('_pageLevelProgress') || !Adapt.course.get('_pageLevelProgress')._isEnabled) {
            return;
        }

        var pageLevelProgress = view.model.get('_pageLevelProgress');
        var viewType = view.model.get('_type');

        // Progress bar should not render for course viewType
        if (viewType == 'course') return;

        if (pageLevelProgress && pageLevelProgress._isEnabled) {

            var completionObject = completionCalculations.calculateCompletion(view.model);

            //take all non-assessment components and subprogress info into the percentage
            //this allows the user to see if the assessments are passed (subprogress) and all other components are complete
            
            var completed = completionObject.nonAssessmentCompleted + completionObject.subProgressCompleted;
            var total = completionObject.nonAssessmentTotal + completionObject.subProgressTotal;

            var percentageComplete = Math.floor((completed / total)*100);
            
            view.model.set('completedChildrenAsPercentage', percentageComplete);
            view.$el.find('.menu-item-inner').append(new PageLevelProgressMenuView({model: view.model}).$el);

        }

    });

    // This should add/update progress on page navigation bar
    Adapt.on('router:page', function(pageModel) {

        // do not proceed until pageLevelProgress enabled on course.json
        if (!Adapt.course.get('_pageLevelProgress') || !Adapt.course.get('_pageLevelProgress')._isEnabled) {
            return;
        }

        var currentPageComponents = pageModel.findDescendants('components').where({'_isAvailable': true});
        var enabledProgressComponents = completionCalculations.getPageLevelProgressEnabledModels(currentPageComponents);

        if (enabledProgressComponents.length > 0) {
            setupPageLevelProgress(pageModel, enabledProgressComponents);
        }

    });

});

define('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesView',['require','backbone','coreJS/adapt'],function(require) {

    var Backbone = require('backbone');
    var Adapt = require('coreJS/adapt');

    var ResourcesView = Backbone.View.extend({

        className: "resources",

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.render();
        },

        events: {
            'click .resources-filter button': 'onFilterClicked',
            'click .resources-item-container button': 'onResourceClicked'
        },

        render: function() {
            var collectionData = this.collection.toJSON();
            var modelData = this.model.toJSON();
            var template = Handlebars.templates["resources"];
            this.$el.html(template({model: modelData, resources:collectionData, _globals: Adapt.course.get('_globals')}));
            _.defer(_.bind(this.postRender, this));
            return this;
        },

        postRender: function() {
            this.listenTo(Adapt, 'drawer:triggerCustomView', this.remove);
        },

        onFilterClicked: function(event) {
            event.preventDefault();
            var $currentTarget = $(event.currentTarget);
            this.$('.resources-filter button').removeClass('selected');
            var filter = $currentTarget.addClass('selected').attr('data-filter');
            var items = [];

            if (filter === 'all') {
                items = this.$('.resources-item').removeClass('display-none');
            } else {
                this.$('.resources-item').removeClass('display-none').not("." + filter).addClass('display-none');
                items = this.$('.resources-item.' + filter);
            }

            if (items.length === 0) return;
            $(items[0]).a11y_focus();
        },

        onResourceClicked: function(event) {
            window.open($(event.currentTarget).data("href"));
        }
    });

    return ResourcesView;
})
;
define('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesHelpers',['require','handlebars'],function(require) {

	var Handlebars = require('handlebars');

	Handlebars.registerHelper('if_collection_contains', function(collection, attribute, value, block) {
		var makeBlockVisible = false;

		_.each(collection, function(resource) {
			if (resource[attribute] === value) {
				makeBlockVisible = true;
			}
		});
		if(makeBlockVisible) {
            return block.fn(this);
        } else {
            return block.inverse();
        }
    });

    Handlebars.registerHelper('if_collection_contains_only_one_item', function(collection, attribute, block) {
		var attributeCount = [];

		_.each(collection, function(resource) {
			var resourceAttribute = resource[attribute];
			if (_.indexOf(attributeCount, resourceAttribute) === -1) {
				attributeCount.push(resourceAttribute);
			}
		});

		if (attributeCount.length <= 1) {
			return block.fn(this);
		} else {
			return block.inverse(this);
		}

    });

    Handlebars.registerHelper('return_column_layout_from_collection_length', function(collection, attribute) {
		var attributeCount = [];

		_.each(collection, function(resource) {
			var resourceAttribute = resource[attribute];
			if (_.indexOf(attributeCount, resourceAttribute) === -1) {
				attributeCount.push(resourceAttribute);
			}
		});

		return (attributeCount.length + 1);

    });

})
	;
define('extensions/adapt-contrib-resources/js/adapt-contrib-resources',['require','coreJS/adapt','backbone','extensions/adapt-contrib-resources/js/adapt-contrib-resourcesView','extensions/adapt-contrib-resources/js/adapt-contrib-resourcesHelpers'],function(require) {

	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var ResourcesView = require('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesView');
	var ResourcesHelpers = require('extensions/adapt-contrib-resources/js/adapt-contrib-resourcesHelpers');

	function setupResources(resourcesModel, resourcesItems) {

		var resourcesCollection = new Backbone.Collection(resourcesItems);
		var resourcesModel = new Backbone.Model(resourcesModel);

		Adapt.on('resources:showResources', function() {
			Adapt.drawer.triggerCustomView(new ResourcesView({
				model: resourcesModel, 
				collection: resourcesCollection
			}).$el);
		});
	
	}

	Adapt.once('app:dataReady', function() {

		var courseResources = Adapt.course.get('_resources');

		if (courseResources) {
			var drawerObject = {
		        title: courseResources.title,
		        description: courseResources.description,
		        className: 'resources-drawer'
		    };
		    // Syntax for adding a Drawer item
		    // Adapt.drawer.addItem([object], [callbackEvent]);
		    Adapt.drawer.addItem(drawerObject, 'resources:showResources');
		} else {
			return console.log('Sorry, no resources object is set on the course.json file');
		}

		setupResources(courseResources, courseResources._resourcesItems);

	});

});
/*global console*/

/* ===========================================================

pipwerks SCORM Wrapper for JavaScript
v1.1.20150614

Created by Philip Hutchison, January 2008-2014
https://github.com/pipwerks/scorm-api-wrapper

Copyright (c) Philip Hutchison
MIT-style license: http://pipwerks.mit-license.org/

This wrapper works with both SCORM 1.2 and SCORM 2004.

Inspired by APIWrapper.js, created by the ADL and
Concurrent Technologies Corporation, distributed by
the ADL (http://www.adlnet.gov/scorm).

SCORM.API.find() and SCORM.API.get() functions based
on ADL code, modified by Mike Rustici
(http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison

=============================================================== */


var pipwerks = {};                                  //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
pipwerks.UTILS = {};                                //For holding UTILS functions
pipwerks.debug = { isActive: true };                //Enable (true) or disable (false) for debug mode

pipwerks.SCORM = {                                  //Define the SCORM object
    version:    null,                               //Store SCORM version.
    handleCompletionStatus: true,                   //Whether or not the wrapper should automatically handle the initial completion status
    handleExitMode: true,                           //Whether or not the wrapper should automatically handle the exit mode
    API:        { handle: null,
                  isFound: false },                 //Create API child object
    connection: { isActive: false },                //Create connection child object
    data:       { completionStatus: null,
                  exitStatus: null },               //Create data child object
    debug:      {}                                  //Create debug child object
};



/* --------------------------------------------------------------------------------
   pipwerks.SCORM.isAvailable
   A simple function to allow Flash ExternalInterface to confirm
   presence of JS wrapper before attempting any LMS communication.

   Parameters: none
   Returns:    Boolean (true)
----------------------------------------------------------------------------------- */

pipwerks.SCORM.isAvailable = function(){
    return true;
};



// ------------------------------------------------------------------------- //
// --- SCORM.API functions ------------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.find(window)
   Looks for an object named API in parent and opener windows

   Parameters: window (the browser window object).
   Returns:    Object if API is found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.find = function(win){

    var API = null,
        findAttempts = 0,
        findAttemptLimit = 500,
        traceMsgPrefix = "SCORM.API.find",
        trace = pipwerks.UTILS.trace,
        scorm = pipwerks.SCORM;

    while ((!win.API && !win.API_1484_11) &&
           (win.parent) &&
           (win.parent != win) &&
           (findAttempts <= findAttemptLimit)){

                findAttempts++;
                win = win.parent;

    }

    //If SCORM version is specified by user, look for specific API
    if(scorm.version){

        switch(scorm.version){

            case "2004" :

                if(win.API_1484_11){

                    API = win.API_1484_11;

                } else {

                    trace(traceMsgPrefix +": SCORM version 2004 was specified by user, but API_1484_11 cannot be found.");

                }

                break;

            case "1.2" :

                if(win.API){

                    API = win.API;

                } else {

                    trace(traceMsgPrefix +": SCORM version 1.2 was specified by user, but API cannot be found.");

                }

                break;

        }

    } else {                             //If SCORM version not specified by user, look for APIs

        if(win.API_1484_11) {            //SCORM 2004-specific API.

            scorm.version = "2004";      //Set version
            API = win.API_1484_11;

        } else if(win.API){              //SCORM 1.2-specific API

            scorm.version = "1.2";       //Set version
            API = win.API;

        }

    }

    if(API){

        trace(traceMsgPrefix +": API found. Version: " +scorm.version);
        trace("API: " +API);

    } else {

        trace(traceMsgPrefix +": Error finding API. \nFind attempts: " +findAttempts +". \nFind attempt limit: " +findAttemptLimit);

    }

    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.get()
   Looks for an object named API, first in the current window's frame
   hierarchy and then, if necessary, in the current window's opener window
   hierarchy (if there is an opener window).

   Parameters:  None.
   Returns:     Object if API found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.get = function(){

    var API = null,
        win = window,
        scorm = pipwerks.SCORM,
        find = scorm.API.find,
        trace = pipwerks.UTILS.trace;

    API = find(win);

    if(!API && win.parent && win.parent != win){
        API = find(win.parent);
    }

    if(!API && win.top && win.top.opener){
        API = find(win.top.opener);
    }

    //Special handling for Plateau
    //Thanks to Joseph Venditti for the patch
    if(!API && win.top && win.top.opener && win.top.opener.document) {
        API = find(win.top.opener.document);
    }

    if(API){
        scorm.API.isFound = true;
    } else {
        trace("API.get failed: Can't find the API!");
    }

    return API;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.getHandle()
   Returns the handle to API object if it was previously set

   Parameters:  None.
   Returns:     Object (the pipwerks.SCORM.API.handle variable).
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.getHandle = function() {

    var API = pipwerks.SCORM.API;

    if(!API.handle && !API.isFound){

        API.handle = API.get();

    }

    return API.handle;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.connection functions --------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.initialize()
   Tells the LMS to initiate the communication session.

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.initialize = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.initialize ";

    trace("connection.initialize called.");

    if(!scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSInitialize("")); break;
                case "2004": success = makeBoolean(API.Initialize("")); break;
            }

            if(success){

                //Double-check that connection is active and working before returning 'true' boolean
                errorCode = debug.getCode();

                if(errorCode !== null && errorCode === 0){

                    scorm.connection.isActive = true;

                    if(scorm.handleCompletionStatus){

                        //Automatically set new launches to incomplete
                        completionStatus = scorm.status("get");

                        if(completionStatus){

                            switch(completionStatus){

                                //Both SCORM 1.2 and 2004
                                case "not attempted": scorm.status("set", "incomplete"); break;

                                //SCORM 2004 only
                                case "unknown" : scorm.status("set", "incomplete"); break;

                                //Additional options, presented here in case you'd like to use them
                                //case "completed"  : break;
                                //case "incomplete" : break;
                                //case "passed"     : break;    //SCORM 1.2 only
                                //case "failed"     : break;    //SCORM 1.2 only
                                //case "browsed"    : break;    //SCORM 1.2 only

                            }

                            //Commit changes
                            scorm.save();

                        }

                    }

                } else {

                    success = false;
                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                }

            } else {

                errorCode = debug.getCode();

                if(errorCode !== null && errorCode !== 0){

                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));

                } else {

                    trace(traceMsgPrefix +"failed: No response from server.");

                }
            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

          trace(traceMsgPrefix +"aborted: Connection already active.");

     }

     return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.terminate()
   Tells the LMS to terminate the communication session

   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.terminate = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        exitStatus = scorm.data.exitStatus,
        completionStatus = scorm.data.completionStatus,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.connection.terminate ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

             if(scorm.handleExitMode && !exitStatus){

                if(completionStatus !== "completed" && completionStatus !== "passed"){

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "suspend"); break;
                        case "2004": success = scorm.set("cmi.exit", "suspend"); break;
                    }

                } else {

                    switch(scorm.version){
                        case "1.2" : success = scorm.set("cmi.core.exit", "logout"); break;
                        case "2004": success = scorm.set("cmi.exit", "normal"); break;
                    }

                }

            }

            //Ensure we persist the data
            success = scorm.save();

            if(success){
     
                switch(scorm.version){
                    case "1.2" : success = makeBoolean(API.LMSFinish("")); break;
                    case "2004": success = makeBoolean(API.Terminate("")); break;
                }
                   
                if(success){
                        
                    scorm.connection.isActive = false;
                   
                } else {
                        
                    errorCode = debug.getCode();
                    trace(traceMsgPrefix +"failed. \nError code: " +errorCode +" \nError info: " +debug.getInfo(errorCode));
       
                }
                
            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"aborted: Connection already terminated.");

    }

    return success;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.data functions --------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.get(parameter)
   Requests information from the LMS.

   Parameter: parameter (string, name of the SCORM data model element)
   Returns:   string (the value of the specified data model element)
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.get = function(parameter){

    var value = null,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.get(" +parameter +") ";

    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

          if(API){

            switch(scorm.version){
                case "1.2" : value = API.LMSGetValue(parameter); break;
                case "2004": value = API.GetValue(parameter); break;
            }

            errorCode = debug.getCode();

            //GetValue returns an empty string on errors
            //If value is an empty string, check errorCode to make sure there are no errors
            if(value !== "" || errorCode === 0){

                //GetValue is successful.  
                //If parameter is lesson_status/completion_status or exit status, let's
                //grab the value and cache it so we can check it during connection.terminate()
                switch(parameter){

                    case "cmi.core.lesson_status":
                    case "cmi.completion_status" : scorm.data.completionStatus = value; break;

                    case "cmi.core.exit":
                    case "cmi.exit"     : scorm.data.exitStatus = value; break;

                }

            } else {

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +"\nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

    trace(traceMsgPrefix +" value: " +value);

    return String(value);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.set()
   Tells the LMS to assign the value to the named data model element.
   Also stores the SCO's completion status in a variable named
   pipwerks.SCORM.data.completionStatus. This variable is checked whenever
   pipwerks.SCORM.connection.terminate() is invoked.

   Parameters: parameter (string). The data model element
               value (string). The value for the data model element
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.set = function(parameter, value){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        debug = scorm.debug,
        traceMsgPrefix = "SCORM.data.set(" +parameter +") ";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle(),
            errorCode = 0;

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSSetValue(parameter, value)); break;
                case "2004": success = makeBoolean(API.SetValue(parameter, value)); break;
            }

            if(success){

                if(parameter === "cmi.core.lesson_status" || parameter === "cmi.completion_status"){

                    scorm.data.completionStatus = value;

                }

            } else {

                errorCode = debug.getCode();

                trace(traceMsgPrefix +"failed. \nError code: " +errorCode +". \nError info: " +debug.getInfo(errorCode));

            }

        } else {

            trace(traceMsgPrefix +"failed: API is null.");

        }

    } else {

        trace(traceMsgPrefix +"failed: API connection is inactive.");

    }

    return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.save()
   Instructs the LMS to persist all data to this point in the session

   Parameters: None
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.save = function(){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        makeBoolean = pipwerks.UTILS.StringToBoolean,
        traceMsgPrefix = "SCORM.data.save failed";


    if(scorm.connection.isActive){

        var API = scorm.API.getHandle();

        if(API){

            switch(scorm.version){
                case "1.2" : success = makeBoolean(API.LMSCommit("")); break;
                case "2004": success = makeBoolean(API.Commit("")); break;
            }

        } else {

            trace(traceMsgPrefix +": API is null.");

        }

    } else {

        trace(traceMsgPrefix +": API connection is inactive.");

    }

    return success;

};


pipwerks.SCORM.status = function (action, status){

    var success = false,
        scorm = pipwerks.SCORM,
        trace = pipwerks.UTILS.trace,
        traceMsgPrefix = "SCORM.getStatus failed",
        cmi = "";

    if(action !== null){

        switch(scorm.version){
            case "1.2" : cmi = "cmi.core.lesson_status"; break;
            case "2004": cmi = "cmi.completion_status"; break;
        }

        switch(action){

            case "get": success = scorm.data.get(cmi); break;

            case "set": if(status !== null){

                            success = scorm.data.set(cmi, status);

                        } else {

                            success = false;
                            trace(traceMsgPrefix +": status was not specified.");

                        }

                        break;

            default      : success = false;
                        trace(traceMsgPrefix +": no valid action was specified.");

        }

    } else {

        trace(traceMsgPrefix +": action was not specified.");

    }

    return success;

};


// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.debug functions -------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getCode
   Requests the error code for the current error state from the LMS

   Parameters: None
   Returns:    Integer (the last error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getCode = function(){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        code = 0;

    if(API){

        switch(scorm.version){
            case "1.2" : code = parseInt(API.LMSGetLastError(), 10); break;
            case "2004": code = parseInt(API.GetLastError(), 10); break;
        }

    } else {

        trace("SCORM.debug.getCode failed: API is null.");

    }

    return code;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getInfo()
   "Used by a SCO to request the textual description for the error code
   specified by the value of [errorCode]."

   Parameters: errorCode (integer).
   Returns:    String.
----------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";


    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetErrorString(errorCode.toString()); break;
            case "2004": result = API.GetErrorString(errorCode.toString()); break;
        }

    } else {

        trace("SCORM.debug.getInfo failed: API is null.");

    }

    return String(result);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getDiagnosticInfo
   "Exists for LMS specific use. It allows the LMS to define additional
   diagnostic information through the API Instance."

   Parameters: errorCode (integer).
   Returns:    String (Additional diagnostic information about the given error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getDiagnosticInfo = function(errorCode){

    var scorm = pipwerks.SCORM,
        API = scorm.API.getHandle(),
        trace = pipwerks.UTILS.trace,
        result = "";

    if(API){

        switch(scorm.version){
            case "1.2" : result = API.LMSGetDiagnostic(errorCode); break;
            case "2004": result = API.GetDiagnostic(errorCode); break;
        }

    } else {

        trace("SCORM.debug.getDiagnosticInfo failed: API is null.");

    }

    return String(result);

};


// ------------------------------------------------------------------------- //
// --- Shortcuts! ---------------------------------------------------------- //
// ------------------------------------------------------------------------- //

// Because nobody likes typing verbose code.

pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
pipwerks.SCORM.get  = pipwerks.SCORM.data.get;
pipwerks.SCORM.set  = pipwerks.SCORM.data.set;
pipwerks.SCORM.save = pipwerks.SCORM.data.save;
pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;



// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS functions -------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.UTILS.StringToBoolean()
   Converts 'boolean strings' into actual valid booleans.

   (Most values returned from the API are the strings "true" and "false".)

   Parameters: String
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.UTILS.StringToBoolean = function(value){
    var t = typeof value;
    switch(t){
       //typeof new String("true") === "object", so handle objects as string via fall-through. 
       //See https://github.com/pipwerks/scorm-api-wrapper/issues/3
       case "object":  
       case "string": return (/(true|1)/i).test(value);
       case "number": return !!value;
       case "boolean": return value;
       case "undefined": return null;
       default: return false;
    }
};



/* -------------------------------------------------------------------------
   pipwerks.UTILS.trace()
   Displays error messages when in debug mode.

   Parameters: msg (string)
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.UTILS.trace = function(msg){

     if(pipwerks.debug.isActive){

        if(window.console && window.console.log){
            window.console.log(msg);
        } else {
            //alert(msg);
        }

     }
};

define("extensions/adapt-contrib-spoor/js/scorm/API", function(){});

define ('extensions/adapt-contrib-spoor/js/scorm/wrapper',['require'],function(require) {

	/*
		IMPORTANT: This wrapper uses the Pipwerks SCORM wrapper and should therefore support both SCORM 1.2 and 2004. Ensure any changes support both versions.
	*/

	var ScormWrapper = function() {
		/* configuration */
		this.setCompletedWhenFailed = true;// this only applies to SCORM 2004
		/**
		 * whether to commit each time there's a change to lesson_status or not
		 */
		this.commitOnStatusChange = true;
		/**
		 * how frequently (in minutes) to commit automatically. set to 0 to disable.
		 */
		this.timedCommitFrequency = 10;
		/**
		 * how many times to retry if a commit fails
		 */
		this.maxCommitRetries = 5;
		/**
		 * time (in milliseconds) to wait between retries
		 */
		this.commitRetryDelay = 1000;
		
		/**
		 * prevents commit from being called if there's already a 'commit retry' pending.
		 */
		this.commitRetryPending = false;
		/**
		 * how many times we've done a 'commit retry'
		 */
		this.commitRetries = 0;
		/**
		 * not currently used - but you could include in an error message to show when data was last saved
		 */
		this.lastCommitSuccessTime = null;
		
		this.timedCommitIntervalID = null;
		this.retryCommitTimeoutID = null;
		this.logOutputWin = null;
		this.startTime = null;
		this.endTime = null;
		
		this.lmsConnected = false;
		this.finishCalled = false;
		
		this.logger = Logger.getInstance();
		this.scorm = pipwerks.SCORM;

        	this.suppressErrors = false;
        
		if (window.__debug)
			this.showDebugWindow();
	};

	// static
	ScormWrapper.instance = null;

	/******************************* public methods *******************************/

	// static
	ScormWrapper.getInstance = function() {
		if (ScormWrapper.instance === null)
			ScormWrapper.instance = new ScormWrapper();
		return ScormWrapper.instance;
	};

	ScormWrapper.prototype.getVersion = function() {
		return this.scorm.version;
	};

	ScormWrapper.prototype.setVersion = function(value) {
		this.scorm.version = value;
		/**
		 * stop the pipwerks code from setting cmi.core.exit to suspend/logout when targeting SCORM 1.2.
		 * there doesn't seem to be any tangible benefit to doing this in 1.2 and it can actually cause problems with some LMSes
		 * (e.g. setting it to 'logout' apparently causes Plateau to log the user completely out of the LMS!)
		 * It needs to be on for SCORM 2004 though, otherwise the LMS might not restore the suspend_data
		 */
		this.scorm.handleExitMode = this.isSCORM2004();
	};

	ScormWrapper.prototype.initialize = function() {
		this.lmsConnected = this.scorm.init();

		if (this.lmsConnected) {
			this.startTime = new Date();
			
			this.initTimedCommit();
		}
		else {
			this.handleError("Course could not connect to the LMS");
		}
		
		return this.lmsConnected;
	};

	/**
	* allows you to check if this is the user's first ever 'session' of a SCO, even after the lesson_status has been set to 'incomplete'
	*/
	ScormWrapper.prototype.isFirstSession = function() {
		return (this.getValue(this.isSCORM2004() ? "cmi.entry" :"cmi.core.entry") === "ab-initio");
	};

	ScormWrapper.prototype.setIncomplete = function() {
		this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "incomplete");

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setCompleted = function() {
		this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "completed");
		
		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setPassed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.completion_status", "completed");
			this.setValue("cmi.success_status", "passed");
		}
		else {
			this.setValue("cmi.core.lesson_status", "passed");
		}

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setFailed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.success_status", "failed");
			
			if(this.setCompletedWhenFailed)
				this.setValue("cmi.completion_status", "completed");
		}
		else {
			this.setValue("cmi.core.lesson_status", "failed");
		}

			if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.getStatus = function() {
		var status = this.getValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status");

		switch(status.toLowerCase()) {// workaround for some LMSes (e.g. Arena) not adhering to the all-lowercase rule
			case "passed":
			case "completed":
			case "incomplete":
			case "failed":
			case "browsed":
			case "not attempted":
			case "not_attempted":// mentioned in SCORM 2004 docs but not sure it ever gets used
			case "unknown": //the SCORM 2004 version if not attempted
				return status;
			break;
			default:
				this.handleError("ScormWrapper::getStatus: invalid lesson status '" + status + "' received from LMS");
				return null;
		}
	};

	ScormWrapper.prototype.setStatus = function(status) {
		switch (status.toLowerCase()){
        case "incomplete":
          this.setIncomplete();
          break;
        case "completed":
          this.setCompleted();
          break;
        case "passed":
          this.setPassed();
          break;
        case "failed":
          this.setFailed();
          break;
        default:
          this.handleError("ScormWrapper::setStatus: the status '" + status + "' is not supported.");
          break;
      }
	}

	ScormWrapper.prototype.getScore = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.score.raw" : "cmi.core.score.raw");
	};

	ScormWrapper.prototype.setScore = function(_score, _minScore, _maxScore) {
		if (this.isSCORM2004()) {
			this.setValue("cmi.score.raw", _score) && this.setValue("cmi.score.min", _minScore) && this.setValue("cmi.score.max", _maxScore) && this.setValue("cmi.score.scaled", _score / 100);
		}
		else {
			this.setValue("cmi.core.score.raw", _score);

			if(this.isSupported("cmi.core.score.min")) this.setValue("cmi.core.score.min", _minScore);

			if(this.isSupported("cmi.core.score.max")) this.setValue("cmi.core.score.max", _maxScore);
		}
	};

	ScormWrapper.prototype.getLessonLocation = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location");
	};

	ScormWrapper.prototype.setLessonLocation = function(_location) {
		this.setValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location", _location);
	};

	ScormWrapper.prototype.getSuspendData = function() {
		return this.getValue("cmi.suspend_data");
	};

	ScormWrapper.prototype.setSuspendData = function(_data) {
		this.setValue("cmi.suspend_data", _data);
	};

	ScormWrapper.prototype.getStudentName = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.learner_name" : "cmi.core.student_name");
	};

	ScormWrapper.prototype.getStudentId = function(){
		return this.getValue(this.isSCORM2004() ? "cmi.learner_id":"cmi.core.student_id");
	};

	ScormWrapper.prototype.commit = function() {
		this.logger.debug("ScormWrapper::commit");
		
		if (this.lmsConnected) {
			if (this.commitRetryPending) {
				this.logger.debug("ScormWrapper::commit: skipping this commit call as one is already pending.");
			}
			else {
				if (this.scorm.save()) {
					this.commitRetries = 0;
					this.lastCommitSuccessTime = new Date();
				}
				else {
					if (this.commitRetries < this.maxCommitRetries && !this.finishCalled) {
						this.commitRetries++;
						this.initRetryCommit();
					}
					else {
						var _errorCode = this.scorm.debug.getCode();

						var _errorMsg = "Course could not commit data to the LMS";
						_errorMsg += "\nError " + _errorCode + ": " + this.scorm.debug.getInfo(_errorCode);
						_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);

						this.handleError(_errorMsg);
					}
				}
			}
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.finish = function() {
		this.logger.debug("ScormWrapper::finish");
		
		if (this.lmsConnected && !this.finishCalled) {
			this.finishCalled = true;
			
			if(this.timedCommitIntervalID != null) {
				window.clearInterval(this.timedCommitIntervalID);
			}
			
			if(this.commitRetryPending) {
				window.clearTimeout(this.retryCommitTimeoutID);
				this.commitRetryPending = false;
			}
			
			if (this.logOutputWin && !this.logOutputWin.closed) {
				this.logOutputWin.close();
			}
			
			this.endTime = new Date();
			
			if (this.isSCORM2004()) {
				this.scorm.set("cmi.session_time", this.convertMilliSecondsToSCORM2004Time(this.endTime.getTime() - this.startTime.getTime()));
			}
			else {
				this.scorm.set("cmi.core.session_time", this.convertMilliSecondsToSCORMTime(this.endTime.getTime() - this.startTime.getTime()));
				this.scorm.set("cmi.core.exit", "");
			}
			
			// api no longer available from this point
			this.lmsConnected = false;
			
			if (!this.scorm.quit()) {
				this.handleError("Course could not finish");
			}
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.recordInteraction = function(strID, strResponse, strCorrect, strLatency, scormInteractionType) {
		if(this.isSupported("cmi.interactions._count")) {
			switch(scormInteractionType) {
				case "choice":
					var responseIdentifiers = [];
					var answers = strResponse.split("#");
					
					for (var i = 0, count = answers.length; i < count; i++) {
						responseIdentifiers.push(new ResponseIdentifier(answers[i], answers[i]));
					}
					
					this.recordMultipleChoiceInteraction(strID, responseIdentifiers, strCorrect, null, null, null, strLatency, null);
				break;

				case "matching":
					var matchingResponses = [];
					var sourceTargetPairs = strResponse.split("#");
					var sourceTarget = null;
					
					for (var i = 0, count = sourceTargetPairs.length; i < count; i++) {
						sourceTarget = sourceTargetPairs[i].split(".");
						matchingResponses.push(new MatchingResponse(sourceTarget[0], sourceTarget[1]));
					}
					
					this.recordMatchingInteraction(strID, matchingResponses, strCorrect, null, null, null, strLatency, null);
				break;

				case "numeric":
					this.recordNumericInteraction(strID, strResponse, strCorrect, null, null, null, strLatency, null);
				break;

				case "fill-in":
					this.recordFillInInteraction(strID, strResponse, strCorrect, null, null, null, strLatency, null);
				break;

				default:
					console.error("ScormWrapper.recordInteraction: unknown interaction type of '" + scormInteractionType + "' encountered...");
			}
		}
		else {
			this.logger.info("ScormWrapper::recordInteraction: cmi.interactions are not supported by this LMS...");
		}
	}

	/****************************** private methods ******************************/
	ScormWrapper.prototype.getValue = function(_property) {
		this.logger.debug("ScormWrapper::getValue: _property=" + _property);

		if(this.finishCalled) {
			this.logger.debug("ScormWrapper::getValue: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _value = this.scorm.get(_property);
			var _errorCode = this.scorm.debug.getCode();
			var _errorMsg = "";
			
			if (_errorCode !== 0) {
				if (_errorCode === 403) {
					this.logger.warn("ScormWrapper::getValue: data model element not initialized");
				}
				else {
					_errorMsg += "Course could not get " + _property;
					_errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
					_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);
					
					this.handleError(_errorMsg);
				}
			}
			this.logger.debug("ScormWrapper::getValue: returning " + _value);
			return _value + "";
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	ScormWrapper.prototype.setValue = function(_property, _value) {
		this.logger.debug("ScormWrapper::setValue: _property=" + _property + " _value=" + _value);

		if(this.finishCalled)	{
			this.logger.debug("ScormWrapper::setValue: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _success = this.scorm.set(_property, _value);
			var _errorCode = this.scorm.debug.getCode();
			var _errorMsg = "";
			
			if (!_success) {
			/*
			* Some LMSes have an annoying tendency to return false from a set call even when it actually worked fine.
			* So, we should throw an error _only_ if there was a valid error code...
			*/
				if(_errorCode !== 0) {
					_errorMsg += "Course could not set " + _property + " to " + _value;
					_errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
					_errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);
					
					this.handleError(_errorMsg);
				}
				else {
					this.logger.warn("ScormWrapper::setValue: LMS reported that the 'set' call failed but then said there was no error!");
				}
			}
			
			return _success;
		}
		else {
			this.handleError("Course is not connected to the LMS");
		}
	};

	/**
	* used for checking any data field that is not 'LMS Mandatory' to see whether the LMS we're running on supports it or not.
	* Note that the way this check is being performed means it wouldn't work for any element that is
	* 'write only', but so far we've not had a requirement to check for any optional elements that are.
	*/
	ScormWrapper.prototype.isSupported = function(_property) {
		this.logger.debug("ScormWrapper::isSupported: _property=" + _property);

		if(this.finishCalled) {
			this.logger.debug("ScormWrapper::isSupported: ignoring request as 'finish' has been called");
			return;
		}
		
		if (this.lmsConnected) {
			var _value = this.scorm.get(_property);
			var _errorCode = this.scorm.debug.getCode();
			
			return (_errorCode === 401 ? false : true);
		}
		else {
			this.handleError("Course is not connected to the LMS");
			return false;
		}
	};

	ScormWrapper.prototype.initTimedCommit = function() {
		this.logger.debug("ScormWrapper::initTimedCommit");
		
		if(this.timedCommitFrequency > 0) {
			var delay = this.timedCommitFrequency * (60 * 1000);
			this.timedCommitIntervalID = window.setInterval(_.bind(this.commit, this), delay);
		}
	};

	ScormWrapper.prototype.initRetryCommit = function() {
		this.logger.debug("ScormWrapper::initRetryCommit " + this.commitRetries + " out of " + this.maxCommitRetries);
		
		this.commitRetryPending = true;// stop anything else from calling commit until this is done
		
		this.retryCommitTimeoutID = window.setTimeout(_.bind(this.doRetryCommit, this), this.commitRetryDelay);
	};

	ScormWrapper.prototype.doRetryCommit = function() {
		this.logger.debug("ScormWrapper::doRetryCommit");

		this.commitRetryPending = false;

		this.commit();
	};

	ScormWrapper.prototype.handleError = function(_msg) {
		this.logger.error(_msg);
		
		if (!this.suppressErrors && (!this.logOutputWin || this.logOutputWin.closed) && confirm("An error has occured:\n\n" + _msg + "\n\nPress 'OK' to view debug information to send to technical support."))
			this.showDebugWindow();
	};

	ScormWrapper.prototype.createValidIdentifier = function(str)
	{
		str = this.trim(new String(str));

		if (_.indexOf(str.toLowerCase(), "urn:") === 0) {
			str = str.substr(4);
		}
		
		// URNs may only contain the following characters: letters, numbers - ( ) + . : = @ ; $ _ ! * ' %
		// if anything else is found, replace it with _
		str = str.replace(/[^\w\-\(\)\+\.\:\=\@\;\$\_\!\*\'\%]/g, "_");

		return str;
	};

	ScormWrapper.prototype.createResponseIdentifier = function(strShort, strLong) {
		
		if (strShort.length != 1 || strShort.search(/\w/) < 0) {
			strShort = "";
		}
		else {
			strShort = strShort.toLowerCase();
		}
		
		strLong = this.createValidIdentifier(strLong);
		
		return new ResponseIdentifier(strShort, strLong);
	};

	ScormWrapper.prototype.recordInteraction12 = function(strID, strResponse, bCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, scormInteractionType, strAlternateResponse, strAlternateCorrectResponse) {
		var bResult;
		var bTempResult;
		var interactionIndex;
		var strResult;
		
		// in SCORM 1.2, add a new interaction rather than updating an old one, because some LMS vendors have misinterpreted the "write only" rule regarding interactions to mean "write once"
		interactionIndex = this.getValue("cmi.interactions._count");
		
		if (interactionIndex === "") {
			interactionIndex = 0;
		}
		
		if (bCorrect === true || bCorrect === "true" || bCorrect === "correct") {
			strResult = "correct";
		}
		else if (bCorrect === false || bCorrect === "false" || bCorrect === "wrong") {
			strResult = "wrong";
		}
		else if (bCorrect === "unanticipated") {
			strResult = "unanticipated";
		}
		else if (bCorrect === "neutral") {
			strResult = "neutral";
		}

		var prefix = "cmi.interactions." + interactionIndex;
		
		bResult = this.setValue(prefix + ".id", strID);
		bResult = bResult && this.setValue(prefix + ".type", scormInteractionType);
		
		bTempResult = this.setValue(prefix + ".student_response", strResponse);
		
		if (bTempResult === false) {
			bTempResult = this.setValue(prefix + ".student_response", strAlternateResponse);
		}
		
		bResult = bResult && bTempResult;
		
		if (!_.isEmpty(strCorrectResponse)) {
			bTempResult = this.setValue(prefix + ".correct_responses.0.pattern", strCorrectResponse);
			if (bTempResult === false) {
				bTempResult = this.setValue(prefix + ".correct_responses.0.pattern", strAlternateCorrectResponse);
			}
			
			bResult = bResult && bTempResult;
		}

		if (!_.isEmpty(strResult)) {
			bResult = bResult && this.setValue(prefix + ".result", strResult);
		}
		
		// ignore the description parameter in SCORM 1.2, there is nothing we can do with it
		
		if (!_.isEmpty(intWeighting)) {
			bResult = bResult && this.setValue(prefix + ".weighting", intWeighting);
		}

		if (!_.isEmpty(intLatency)) {
			bResult = bResult && this.setValue(prefix + ".latency", this.convertMilliSecondsToSCORMTime(intLatency));
		}
		
		if (!_.isEmpty(strLearningObjectiveID)) {
			bResult = bResult && this.setValue(prefix + ".objectives.0.id", strLearningObjectiveID);
		}
		
		bResult = bResult && this.setValue(prefix + ".time", this.convertDateToCMITime(dtmTime));
		
		return bResult;
	};

	ScormWrapper.prototype.recordInteraction2004 = function(strID, strResponse, bCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, scormInteractionType) {	
		var bResult;
		var interactionIndex;
		var strResult;
		
		bCorrect = new String(bCorrect);
		
		interactionIndex = this.getValue("cmi.interactions._count");
		
		if (interactionIndex === "") {
			interactionIndex = 0;
		}
		
		if (bCorrect === true || bCorrect === "true" || bCorrect === "correct") {
			strResult = "correct";
		}
		else if (bCorrect === false || bCorrect == "false" || bCorrect === "wrong") {
			strResult = "incorrect";
		}
		else if (bCorrect === "unanticipated") {
			strResult = "unanticipated";
		}
		else if (bCorrect === "neutral") {
			strResult = "neutral";
		}
		else {
			strResult = "";
		}
		
		strID = this.createValidIdentifier(strID);

		var prefix = "cmi.interactions." + interactionIndex;
		
		bResult = this.setValue(prefix + ".id", strID);
		bResult = bResult && this.setValue(prefix + ".type", scormInteractionType);
		bResult = bResult && this.setValue(prefix + ".learner_response", strResponse);
		
		if (!_.isEmpty(strResult)) {
			bResult = bResult && this.setValue(prefix + ".result", strResult);
		}
		
		if (!_.isEmpty(strCorrectResponse)) {
			bResult = bResult && this.setValue(prefix + ".correct_responses.0.pattern", strCorrectResponse);
		}
		
		if (!_.isEmpty(strDescription)) {
			bResult = bResult && this.setValue(prefix + ".description", strDescription);
		}
		
		// ignore the description parameter in SCORM 1.2, there is nothing we can do with it
		
		if (!_.isEmpty(intWeighting)) {
			bResult = bResult && this.setValue(prefix + ".weighting", intWeighting);
		}

		if (!_.isEmpty(intLatency)) {
			bResult = bResult && this.setValue(prefix + ".latency", this.convertMilliSecondsToSCORM2004Time(intLatency));
		}
		
		if (!_.isEmpty(strLearningObjectiveID)) {
			bResult = bResult && this.setValue(prefix + ".objectives.0.id", strLearningObjectiveID);
		}
		
		bResult = bResult && this.setValue(prefix + ".timestamp", this.convertDateToISO8601Timestamp(dtmTime));
		
		return bResult;
	};

	ScormWrapper.prototype.recordMultipleChoiceInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var _responseArray = null;
		var _correctResponseArray = null;
		
		if (response.constructor == String) {
			_responseArray = [this.createResponseIdentifier(response, response)];
		}
		else if (response.constructor == ResponseIdentifier) {
			_responseArray = [response];
		}
		else if (response.constructor == Array || response.constructor.toString().search("Array") > 0) {
			_responseArray = response;
		}
		else if (window.console && response.constructor.toString() == "(Internal Function)" && response.length > 0) {
			_responseArray = response;
		}
		else {
			this.handleError("ScormWrapper::recordMultipleChoiceInteraction: response is not in the correct format");
			return false;
		}
		
		if (!_.isEmpty(correctResponse)) {
			if (correctResponse.constructor == String) {
				_correctResponseArray = [this.createResponseIdentifier(correctResponse, correctResponse)];
			}
			else if (correctResponse.constructor == ResponseIdentifier) {
				_correctResponseArray = [correctResponse];
			}
			else if (correctResponse.constructor == Array || correctResponse.constructor.toString().search("Array") > 0) {
				_correctResponseArray = correctResponse;
			}
			else if (window.console && correctResponse.constructor.toString() == "(Internal Function)" && correctResponse.length > 0) {
				_correctResponseArray = correctResponse;
			}
			else {
				this.handleError("ScormWrapper::recordMultipleChoiceInteraction: correct response is not in the correct format");
				return false;
			}
		}
		else {
			_correctResponseArray = [];
		}
		
		var dtmTime = new Date();
		
		var strResponse = "";
		var strResponseLong = "";
		
		var strCorrectResponse = "";
		var strCorrectResponseLong = "";
		
		for (var i = 0; i < _responseArray.length; i++)	{
			if (strResponse.length > 0) {strResponse += this.isSCORM2004() ? "[,]" : ",";}
			if (strResponseLong.length > 0) {strResponseLong += ",";}
			
			strResponse += this.isSCORM2004() ? _responseArray[i].Long : _responseArray[i].Short;
			strResponseLong += _responseArray[i].Long;
		}

		for (var i = 0; i < _correctResponseArray.length; i++)	{
			if (strCorrectResponse.length > 0) {strCorrectResponse += this.isSCORM2004() ? "[,]" : ",";}
			if (strCorrectResponseLong.length > 0) {strCorrectResponseLong += ",";}
			
			strCorrectResponse += this.isSCORM2004() ? _correctResponseArray[i].Long : _correctResponseArray[i].Short;
			strCorrectResponseLong += _correctResponseArray[i].Long;
		}
		
		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, strResponse, blnCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "choice");
		
		return this.recordInteraction12(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "choice",  strResponse, strCorrectResponse);
	};

	ScormWrapper.prototype.recordMatchingInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var _responseArray = null;
		var _correctResponseArray = null;
		
		if (response.constructor == MatchingResponse) {
			_responseArray = [response];
		}
		else if (response.constructor == Array || response.constructor.toString().search("Array") > 0) {
			_responseArray = response;
		}
		else if (window.console && response.constructor.toString() == "(Internal Function)" && response.length > 0) {
			_responseArray = response;
		}
		else {
			this.handleError("ScormWrapper::recordMatchingInteraction: response is not in the correct format");
			return false;
		}
		
		if (!_.isEmpty(correctResponse)) {
			if (correctResponse.constructor == MatchingResponse) {
				_correctResponseArray = [correctResponse];
			}
			else if (correctResponse.constructor == Array || correctResponse.constructor.toString().search("Array") > 0) {
				_correctResponseArray = correctResponse;
			}
			else if (window.console && correctResponse.constructor.toString() == "(Internal Function)" && correctResponse.length > 0)	{
				_correctResponseArray = correctResponse;
			}
			else {
				this.handleError("ScormWrapper::recordMatchingInteraction: correct response is not in the correct format");
				return false;
			}
		}
		else {
			_correctResponseArray = [];
		}
		
		var dtmTime = new Date();
		
		var strResponse = "";
		var strResponseLong = "";
		
		var strCorrectResponse = "";
		var strCorrectResponseLong = "";
		
		for (var i = 0; i < _responseArray.length; i++) {
			if (strResponse.length > 0) {strResponse += ",";}
			if (strResponseLong.length > 0) {strResponseLong += this.isSCORM2004() ? "[,]" : ",";}
			
			strResponse += _responseArray[i].Source.Short + "." + _responseArray[i].Target.Short;
			strResponseLong += _responseArray[i].Source.Long + (this.isSCORM2004() ? "[.]" : ".") + _responseArray[i].Target.Long;
		}

		for (var i = 0; i < _correctResponseArray.length; i++) {
			if (strCorrectResponse.length > 0) {strCorrectResponse += ",";}
			if (strCorrectResponseLong.length > 0) {strCorrectResponseLong += this.isSCORM2004() ? "[,]" : ",";}
			
			strCorrectResponse += _correctResponseArray[i].Source.Short + "." + _correctResponseArray[i].Target.Short;
			strCorrectResponseLong += _correctResponseArray[i].Source.Long + (this.isSCORM2004() ? "[.]" : ".") + _correctResponseArray[i].Target.Long;
		}
		
		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "matching");
		
		return this.recordInteraction12(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "matching", strResponse, strCorrectResponse);
	};

	ScormWrapper.prototype.recordNumericInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var dtmTime = new Date();

		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "numeric");
		
		return this.recordInteraction12(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "numeric", response, correctResponse);
	};

	ScormWrapper.prototype.recordFillInInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var dtmTime = new Date();

		var max_len = this.isSCORM2004() ? 250 : 255;

		if(response.length > max_len) {
			response = response.substr(0,max_len);

			this.logger.warn("ScormWrapper::recordFillInInteraction: response data for " + strID + " is longer than the maximum allowed length of " + max_len + " characters; data will be truncated to avoid an error.");
		}

		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "fill-in");
		
		return this.recordInteraction12(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "fill-in", response, correctResponse);
	};

	ScormWrapper.prototype.showDebugWindow = function() {
		
		if (this.logOutputWin && !this.logOutputWin.closed) {
			this.logOutputWin.close();
		}
		
		this.logOutputWin = window.open("log_output.html", "Log", "width=600,height=300,status=no,scrollbars=yes,resize=yes,menubar=yes,toolbar=yes,location=yes,top=0,left=0");
		
		if (this.logOutputWin)
			this.logOutputWin.focus();
		
		return;
	};

	ScormWrapper.prototype.convertMilliSecondsToSCORMTime = function(value) {
		var h;
		var m;
		var s;
		var ms;
		var cs;
		var CMITimeSpan;
		
		ms = value % 1000;

		s = ((value - ms) / 1000) % 60;

		m = ((value - ms - (s * 1000)) / 60000) % 60;

		h = (value - ms - (s * 1000) - (m * 60000)) / 3600000;
		
		if (h === 10000)	{
			h = 9999;
			
			m = (value - (h * 3600000)) / 60000;
			if (m === 100)	{
				m = 99;
			}
			m = Math.floor(m);
			
			s = (value - (h * 3600000) - (m * 60000)) / 1000;
			if (s === 100)	{
				s = 99;
			}
			s = Math.floor(s);
			
			ms = (value - (h * 3600000) - (m * 60000) - (s * 1000));
		}

		cs = Math.floor(ms / 10);

		CMITimeSpan = this.zeroPad(h, 4) + ":" + this.zeroPad(m, 2) + ":" +	this.zeroPad(s, 2);
		CMITimeSpan += "." + cs;
		
		if (h > 9999) {
			CMITimeSpan = "9999:99:99";
			
			CMITimeSpan += ".99";
		}
		
		return CMITimeSpan;
	};

	ScormWrapper.prototype.convertDateToCMITime = function(_value) {
		var h;
		var m;
		var s;
		
		var dtmDate = new Date(_value);
		
		h = dtmDate.getHours();
		m = dtmDate.getMinutes();
		s = dtmDate.getSeconds();
		
		return this.zeroPad(h, 2) + ":" + this.zeroPad(m, 2) + ":" + this.zeroPad(s, 2);
	};

	ScormWrapper.prototype.convertMilliSecondsToSCORM2004Time = function(_value) {
		var str = "";
		var cs;
		var s;
		var m;
		var h;
		var d;
		var mo; // assumed to be an "average" month (a leap year every 4 years) = ((365*4) + 1) / 48 = 30.4375 days per month
		var y;
		
		var HUNDREDTHS_PER_SECOND = 100;
		var HUNDREDTHS_PER_MINUTE = HUNDREDTHS_PER_SECOND * 60;
		var HUNDREDTHS_PER_HOUR   = HUNDREDTHS_PER_MINUTE * 60;
		var HUNDREDTHS_PER_DAY    = HUNDREDTHS_PER_HOUR * 24;
		var HUNDREDTHS_PER_MONTH  = HUNDREDTHS_PER_DAY * (((365 * 4) + 1) / 48);
		var HUNDREDTHS_PER_YEAR   = HUNDREDTHS_PER_MONTH * 12;
		
		cs = Math.floor(_value / 10);
		
		y = Math.floor(cs / HUNDREDTHS_PER_YEAR);
		cs -= (y * HUNDREDTHS_PER_YEAR);
		
		mo = Math.floor(cs / HUNDREDTHS_PER_MONTH);
		cs -= (mo * HUNDREDTHS_PER_MONTH);
		
		d = Math.floor(cs / HUNDREDTHS_PER_DAY);
		cs -= (d * HUNDREDTHS_PER_DAY);
		
		h = Math.floor(cs / HUNDREDTHS_PER_HOUR);
		cs -= (h * HUNDREDTHS_PER_HOUR);
		
		m = Math.floor(cs / HUNDREDTHS_PER_MINUTE);
		cs -= (m * HUNDREDTHS_PER_MINUTE);
		
		s = Math.floor(cs / HUNDREDTHS_PER_SECOND);
		cs -= (s * HUNDREDTHS_PER_SECOND);
		
		if (y > 0)
			str += y + "Y";
		if (mo > 0)
			str += mo + "M";
		if (d > 0)
			str += d + "D";
		
		// check to see if we have any time before adding the "T"
		if ((cs + s + m + h) > 0 ) {
			
			str += "T";
			
			if (h > 0)
				str += h + "H";
			
			if (m > 0)
				str += m + "M";
			
			if ((cs + s) > 0) {
				str += s;
				
				if (cs > 0)
					str += "." + cs;
				
				str += "S";
			}
		}
		
		if (str === "")
			str = "0S";
		
		str = "P" + str;
		
		return str;
	};

	ScormWrapper.prototype.convertDateToISO8601Timestamp = function(_value) {
		var str;
		
		var dtm = new Date(_value);
		
		var y = dtm.getFullYear();
		var mo = dtm.getMonth() + 1;
		var d = dtm.getDate();
		var h = dtm.getHours();
		var m = dtm.getMinutes();
		var s = dtm.getSeconds();
		
		mo = this.zeroPad(mo, 2);
		d = this.zeroPad(d, 2);
		h = this.zeroPad(h, 2);
		m = this.zeroPad(m, 2);
		s = this.zeroPad(s, 2);
		
		str = y + "-" + mo + "-" + d + "T" + h + ":" + m + ":" + s;
		
		return str;
	};

	ScormWrapper.prototype.zeroPad = function(intNum, intNumDigits) {
		var strTemp;
		var intLen;
		var i;
		
		strTemp = new String(intNum);
		intLen = strTemp.length;
		
		if (intLen > intNumDigits) {
			strTemp = strTemp.substr(0, intNumDigits);
		}
		else {
			for (i = intLen; i < intNumDigits; i++)
				strTemp = "0" + strTemp;
		}
		
		return strTemp;
	};

	ScormWrapper.prototype.trim = function(str) {
		return str.replace(/^\s*|\s*$/g, "");
	};

	ScormWrapper.prototype.isSCORM2004 = function() {
		return this.scorm.version === "2004";
	};

	var MatchingResponse = function(source, target){
		if (source.constructor == String){
			source = ScormWrapper.getInstance().createResponseIdentifier(source, source);
		}

		if (target.constructor == String){
			target = ScormWrapper.getInstance().createResponseIdentifier(target, target);
		}
		
		this.Source = source;
		this.Target = target;
	};

	MatchingResponse.prototype.toString = function(){
		return "[Matching Response " + this.Source + ", " + this.Target + "]";
	};

	var ResponseIdentifier = function(strShort, strLong) {
		this.Short = new String(strShort);
		this.Long = new String(strLong);
	};

	ResponseIdentifier.prototype.toString = function() {
		return "[Response Identifier " + this.Short + ", " + this.Long + "]";
	};

	return ScormWrapper;
});

Logger = function() {
	this.logArr = new Array();
	this.registeredViews = new Array();
};

// static
Logger.instance = null;
Logger.LOG_TYPE_INFO = 0;
Logger.LOG_TYPE_WARN = 1;
Logger.LOG_TYPE_ERROR = 2;
Logger.LOG_TYPE_DEBUG = 3;

Logger.getInstance = function() {
	if (Logger.instance == null)
		Logger.instance = new Logger();
	return Logger.instance;
};

Logger.prototype.getEntries = function() {
	return this.logArr;
};

Logger.prototype.getLastEntry = function() {
	return this.logArr[this.logArr.length - 1];
};

Logger.prototype.info = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_INFO};
	this.updateViews();
};

Logger.prototype.warn = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_WARN};
	this.updateViews();
};

Logger.prototype.error = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_ERROR};
	this.updateViews();
};

Logger.prototype.debug = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_DEBUG};
	this.updateViews();
};

//register a view
Logger.prototype.registerView = function(_view) {
	this.registeredViews[this.registeredViews.length] = _view;
};

//unregister a view
Logger.prototype.unregisterView = function(_view) {
	for (var i = 0; i < this.registeredViews.length; i++)
		if (this.registeredViews[i] == _view) {
			this.registeredViews.splice(i, 1);
			i--;
		}
};

// update all views
Logger.prototype.updateViews = function() {
	for (var i = 0; i < this.registeredViews.length; i++) {
		if (this.registeredViews[i])
			this.registeredViews[i].update(this);
	}
};
define("extensions/adapt-contrib-spoor/js/scorm/logger", function(){});

define('extensions/adapt-contrib-spoor/js/scorm',[
	'./scorm/API',
 	'./scorm/wrapper',
	'./scorm/logger',
], function(API, wrapper, logger) {

	//Load and prepare SCORM API

	return wrapper.getInstance();

});
define('extensions/adapt-contrib-spoor/js/serializers/default',[
    'coreJS/adapt'
], function (Adapt) {

    //Captures the completion status of the blocks
    //Returns and parses a '1010101' style string

    var serializer = {
        serialize: function () {
            return this.serializeSaveState('_isComplete');
        },

        serializeSaveState: function(attribute) {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
            }

            var excludeAssessments = Adapt.config.get('_spoor') && Adapt.config.get('_spoor')._tracking && Adapt.config.get('_spoor')._tracking._excludeAssessments;

            // create the array to be serialised, pre-populated with dashes that represent unused tracking ids - because we'll never re-use a tracking id in the same course
            var data = [];
            var length = Adapt.course.get('_latestTrackingId') + 1;
            for (var i = 0; i < length; i++) {
                data[i] = "-";
            }

            // now go through all the blocks, replacing the appropriate dashes with 0 (incomplete) or 1 (completed) for each of the blocks
            _.each(Adapt.blocks.models, function(model, index) {
                var _trackingId = model.get('_trackingId'),
                    isPartOfAssessment = model.getParent().get('_assessment'),
                    state = model.get(attribute) ? 1: 0;

                if(excludeAssessments && isPartOfAssessment) {
                    state = 0;
                }

                if (_trackingId === undefined) {
                    var message = "Block '" + model.get('_id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                    console.error(message);
                } else {
                    data[_trackingId] = state;
                }
            }, this);

            return data.join("");
        },

        deserialize: function (completion) {

            _.each(this.deserializeSaveState(completion), function(state, blockTrackingId) {
                if (state === 1) {
                    this.markBlockAsComplete(Adapt.blocks.findWhere({_trackingId: blockTrackingId}));
                }
            }, this);

        },    

        deserializeSaveState: function (string) {
            var completionArray = string.split("");

            for (var i = 0; i < completionArray.length; i++) {
                if (completionArray[i] === "-") {
                    completionArray[i] = -1;
                } else {
                    completionArray[i] = parseInt(completionArray[i], 10);
                }
            }

            return completionArray;
        },

        markBlockAsComplete: function(block) {
            if (!block || block.get('_isComplete')) {
                return;
            }
        
            block.getChildren().each(function(child) {
                child.set('_isComplete', true);
            }, this);
        }

    };

    return serializer;
});
//https://raw.githubusercontent.com/oliverfoster/SCORMSuspendDataSerializer 2015-06-27
(function(_) {

	function toPrecision(number, precision) {
		if (precision === undefined) precision = 2
		var multiplier = 1 * Math.pow(10, precision);
		return Math.round(number * multiplier) / multiplier;
	}

	function BinaryToNumber(bin, length) {
		return parseInt(bin.substr(0, length), 2);
	}

	function NumberToBinary(number, length) {
		return Padding.fillLeft( number.toString(2), length );
	}

	var Padding = {
		addLeft: function PaddingAddLeft(str, x , char) {
			char = char || "0";
			return (new Array( x + 1)).join(char) + str;
		},
		addRight: function PaddingAddRight(str, x, char) {
			char = char || "0";
			return  str + (new Array( x + 1)).join(char);
		},
		fillLeft: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillRight: function PaddingFillLeft(str, x, char) {
			if (str.length < x) {
	        	var paddingLength = x - str.length;
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockLeft: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addLeft(str, paddingLength, char)
	        }
	        return str;
		},
		fillBlockRight: function PaddingFillBlockRight(str, x, char) {
			if (str.length % x) {
	        	var paddingLength = x - (str.length % x);
	        	return Padding.addRight(str, paddingLength, char)
	        }
	        return str;
		}
	};

	function Base64() {
		switch (arguments.length) {
		case 1:
			var firstArgumentType = typeof arguments[0];
			switch (firstArgumentType) {
			case "number":
				return Base64._indexes[arguments[0]];
			case "string":
				return Base64._chars[arguments[0]];
			default:
				throw "Invalid arguments type";
			}
		case 2:
			var char = arguments[0];
			var index = arguments[1];
			Base64._chars[char] = index;
			Base64._indexes[index] = char;
			return;
		default:
			throw "Invalid number of arguments";
		}
	}
	Base64._chars = {};
	Base64._indexes = {};
	(function() {
		var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		for (var i = 0, l = alphabet.length; i<l; i++) {
			Base64(alphabet[i], i);
		}
	})();


	function DataType() {
		switch (arguments.length) {
		case 1:
			switch (typeof  arguments[0]) {
			case "object":
				var item = arguments[0]
				if (DataType._types[item.type] === undefined) DataType._types[item.type] = [];
				DataType._types[item.type].push(item);
				item.index = DataType._indexes.length
				DataType._indexes.push(item);
				DataType[item.name] = item;
				return;
			case "string":
				return DataType.getName(arguments[0]);
			case "number":
				return DataType.getIndex(arguments[0]);
			default:
				throw "Argument type not allowed";
			}
		default:
			throw "Too many arguments";
		}
		
	}
	DataType.VARIABLELENGTHDESCRIPTORSIZE = 8;
	DataType._types = {};
	DataType._indexes = [];
	DataType.getName = function DataTypeGetName(name) {
		if (DataType[name])
			return DataType[name];
		throw "Type name not found '"+name+"'";
	};
	DataType.getIndex = function DataTypeGetIndex(index) {
		if (DataType._indexes[index])
			return DataType._indexes[index];
		throw "Type index not found '"+index+"'";
	};
	DataType.getTypes = function DataTypeGetTypes(type) {
		if (DataType._types[type])
			return DataType._types[type];
		throw "Type not found '"+type+"'";
	};
	DataType.checkBounds = function DataTypeCheckBounds(name, number) {
		var typeDef = DataType(name);
		if (number > typeDef.max) throw name + " value is larger than "+typeDef.max;
		if (number < typeDef.min) throw name + " value is smaller than "+typeDef.min;
	};
	DataType.getNumberType = function DataTypeGetNumberType(number) {
		var isDecimal = (number - Math.floor(number)) !== 0;
		var numberDataTypes = DataType.getTypes("number");
		for (var t = 0, type; type = numberDataTypes[t++];) {
			if (number <= type.max && number >= type.min && (!isDecimal || isDecimal == type.decimal) ) {
				return type;
			}
		}
	};
	DataType.getVariableType = function DataTypeGetVariableType(variable) {
		var variableNativeType = variable instanceof Array ? "array" : typeof variable;
		var variableDataType;

		switch(variableNativeType) {
		case "number":
			variableDataType = DataType.getNumberType(variable);
			break;
		case "string":
			variableDataType = DataType.getName("string");
			break;
		default: 
			var supportedItemDataTypes = DataType.getTypes(variableNativeType);
			switch (supportedItemDataTypes.length) {
			case 1:
				variableDataType = supportedItemDataTypes[0];
				break;
			default:
				throw "Type not found '"+variableNativeType+"'";
			}
		}
	
		if (!variableDataType) throw "Cannot assess type '"+variableNativeType+"'";

		return variableDataType;
	};
	DataType.getArrayType = function getArrayType(arr) {
		var foundItemTypes = [];

		for (var i = 0, l = arr.length; i < l; i++) {
			var item = arr[i];
			var itemDataType = DataType.getVariableType(item);

			if (_.findWhere(foundItemTypes, { name: itemDataType.name })) continue;
	
			foundItemTypes.push(itemDataType);
		}

		switch (foundItemTypes.length) {
		case 0:
			throw "Cannot determine array data types";
		case 1:
			//single value type
		 	return foundItemTypes[0];
		default: 
			//many value types
			var nativeTypeNames = _.pluck(foundItemTypes, 'type');
			var uniqueNativeTypeNames = _.uniq(nativeTypeNames);
			var hasManyNativeTypes = (uniqueNativeTypeNames.length > 1);

			if (hasManyNativeTypes) return DataType("variable"); //multiple types in array

			//single native type in array, multiple datatype lengths
			switch (uniqueNativeTypeNames[0]) {
			case "number":
				var foundDecimal = _.findWhere(foundItemTypes, { decimal: true});
				if (foundDecimal) return foundDecimal;
				return _.max(foundItemTypes, function(type) {
					return type.max;
				});
			}

			throw "Unsupported data types";
		}
		
	};
	(function() {
		var types = [
			{
				"size": "fixed",
				"length": 1,
				"name": "boolean",
				"type": "boolean"
			},
			{
				"max": 15,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 4,
				"name": "half",
				"type": "number"
			},
			{
				"max": 255,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 8,
				"name": "byte",
				"type": "number"
			},
			{
				"max": 65535,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 16,
				"name": "short",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": 0,
				"decimal": false,
				"size": "fixed",
				"length": 32,
				"name": "long",
				"type": "number"
			},
			{
				"max": 4294967295,
				"min": -4294967295,
				"decimal": true,
				"precision": 2,
				"size": "variable",
				"name": "double",
				"type": "number"
			},
			{
				"name": "base16",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "base64",
				"size": "variable",
				"type": "string"
			},
			{
				"name": "array",
				"size": "variable",
				"type": "array"
			},
			{
				"name": "variable",
				"size": "variable",
				"type": "variable"
			},
			{
				"name": "string",
				"size": "variable",
				"type": "string"
			}
		];
		for (var i = 0, type; type = types[i++];) {
			DataType(type);
		}
	})();

	

	function Converter(fromType, toType) {
		fromType = Converter.translateTypeAlias(fromType);
		toType = Converter.translateTypeAlias(toType);

		var args = [].slice.call(arguments, 2);

		if (fromType != "binary" && toType != "binary") {
			if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
			if (!Converter._converters[fromType]['binary']) throw "Type not found 'binary'";
			
			var bin = Converter._converters[fromType]['binary'].call(this, args[0], Converter.WRAPOUTPUT);

			if (!Converter._converters['binary'][toType]) throw "Type not found '"+toType+"'";

			return Converter._converters['binary'][toType].call(this, bin, Converter.WRAPOUTPUT);
		}

		if (!Converter._converters[fromType]) throw "Type not found '" + fromType + "'";
		if (!Converter._converters[fromType][toType]) throw "Type not found '" + toType + "'";

		return Converter._converters[fromType][toType].call(this, args[0], Converter.WRAPOUTPUT);
	}
	Converter.WRAPOUTPUT = false;
	Converter.translateTypeAlias = function ConverterTranslateTypeAlias(type) {
		type = type.toLowerCase();
		for (var Type in Converter._typeAliases) {
			if (Type == type || (" "+Converter._typeAliases[Type].join(" ")+" ").indexOf(" "+type+" ") >= 0 ) return Type;
		}
		throw "Type not found '" + type + "'";
	};
	Converter._typeAliases = {
		"base64": [ "b64" ],
		"base16" : [ "hex", "b16" ],
		"double": [ "dbl", "decimal", "d" ],
		"long": [ "lng", "l" ],
		"short": [ "s" ],
		"byte" : [ "b" ],
		"half": [ "h" ],
		"number": [ "num", "n" ],
		"binary": [ "bin" ],
		"boolean": [ "bool" ],
		"array": [ "arr" ]
	};
	Converter._variableWrapLength = function ConverterVariableWrapLength(bin) {
		var variableLength = bin.length;
		var binLength = NumberToBinary(variableLength, DataType.VARIABLELENGTHDESCRIPTORSIZE)

		return binLength + bin;
	};
	Converter._variableLength = function ConverterVariableLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );
		return variableLength;
	};
	Converter._variableUnwrapLength = function ConverterVariableUnwrapLength(bin) {
		var VLDS =  DataType.VARIABLELENGTHDESCRIPTORSIZE;
		var variableLength = BinaryToNumber(bin, VLDS );

		return bin.substr( VLDS, variableLength);
	};
	Converter._converters = {
		"base64": {
			"binary": function ConverterBase64ToBinary(base64) { //TODO PADDING... ?
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 6);
				var paddingLength = BinaryToNumber(binFirstByte, 6);

			    var bin = "";
			    for (var i = 0, ch; ch = base64[i++];) {
			        var block = Base64(ch).toString(2);
			        block = Padding.fillLeft(block, 6);
			        bin += block;
			    }
			    bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"base16": {
			"binary": function ConverterBase16ToBinary(hex) {
				var firstByte = Base64(base64.substr(0,1));
				var binFirstByte = NumberToBinary(firstByte, 4);
				var paddingLength = BinaryToNumber(binFirstByte, 4);

			    var bin = "";
			    for (var i = 0, ch; ch = hex[i++];) {
			        var block = parseInt(ch, 16).toString(2);
			        block = Padding.fillLeft(block, 4);
			        bin += block;
			    }

			     bin =  bin.substr(6+paddingLength);
			    return bin;
			}
		},
		"double": {
			"binary": function ConverterDoubleToBinary(dbl, wrap) {
				var typeDef = DataType("double");
				DataType.checkBounds("double", dbl);

				dbl = toPrecision(dbl, typeDef.precision);

				var dblStr = dbl.toString(10);

				var isMinus = dbl < 0;
			
				var baseStr, exponentStr, highStr, lowStr, decimalPosition, hasDecimal;

				
				var exponentPos = dblStr.indexOf("e");
				if (exponentPos > -1) {
					//exponential float representation "nE-x"
					baseStr = dblStr.substr(0, exponentPos);
					exponentStr = Math.abs(dblStr.substr(exponentPos+1));

					if (isMinus) baseStr = baseStr.substr(1);

					decimalPosition = baseStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);

					if (hasDecimal) {
						highStr = baseStr.substr(0, decimalPosition);
						lowStr = baseStr.substr(decimalPosition+1);

						exponentStr = (Math.abs(exponentStr) + lowStr.length);

						baseStr = highStr + lowStr;
					}

				} else {
					//normal long float representation "0.00000000"
					baseStr = dblStr;
					exponentStr = "0";

					if (isMinus) dblStr = dblStr.substr(1);

					decimalPosition = dblStr.indexOf(".");
					hasDecimal = (decimalPosition > -1);
					if (hasDecimal) {
						highStr = dblStr.substr(0, decimalPosition);
						lowStr = dblStr.substr(decimalPosition+1);

						exponentStr = (lowStr.length);
						if (highStr == "0") {
							baseStr = parseInt(lowStr, 10).toString(10);
						} else {
							baseStr = highStr + lowStr;
						}
					} else {
						baseStr = dblStr;
					}

				}

				var bin = [];

				var binLong = Padding.fillBlockLeft (parseInt(baseStr, 10).toString(2), 4);
				var binMinus = isMinus ? "1" : "0";
				var binExponent = Padding.fillLeft( parseInt(exponentStr, 10).toString(2), 7);
				
				bin.push( binMinus );
				bin.push( binExponent );
				bin.push( binLong );

				if (wrap === false) {
					return bin.join("");
				} else {
					return Converter._variableWrapLength(bin.join(""));
				}
			}
		},
		"long": {
			"binary": function ConverterLongToBinary(value) {
				var typeDef = DataType("long");
				DataType.checkBounds("long", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"short": {
			"binary": function ConverterShortToBinary(value) {
				var typeDef = DataType("short");
				DataType.checkBounds("short", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"byte": {
			"binary": function ConverterByteToBinary(value) {
				var typeDef = DataType("byte");
				DataType.checkBounds("byte", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"half": {
			"binary": function ConverterHalfToBinary(value) {
				var typeDef = DataType("half");
				DataType.checkBounds("half", value);
				value = toPrecision(value, 0);
				return Padding.fillLeft(value.toString(2), typeDef.length);
			}
		},
		"boolean": {
			"binary": function ConverterBooleanToBinary(bool) {
				return bool ? "1" : "0";
			},
		},
		"array": {
			"binary": function ConverterArrayToBinary(arr, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");
				var arrayItemType = DataType.getArrayType(arr);
				var isVariableArray = arrayItemType.name == "vairable";

				if (isVariableArray) {
					var bin = half2bin(15);
					//variable array
					return bin;
				} else {
					var binArrayIdentifier = Converter._converters['half']['binary'](arrayItemType.index);

					var binItemsArray = [];
					for (var i = 0, l = arr.length; i < l; i++) {
						var item = arr[i];
						var binItem = Converter._converters[arrayItemType.name]['binary'](item);
						//console.log("binItem", binItem);
						binItemsArray.push( binItem );
					}

					var binItems = binItemsArray.join("");

					var paddingLength = 0;
					if (binItems.length % 4) paddingLength = 4 - (binItems.length % 4);
					var binPaddingLen = NumberToBinary(paddingLength, 2);

					var binPadding = (new Array(paddingLength+1)).join("0");

					var bin = [];
					bin.push(binArrayIdentifier);
					bin.push(binPaddingLen);
					bin.push(binPadding);
					bin.push(binItems);

					var finished = bin.join("");
					//console.log("unwrapped", finished);

					if (wrap === false) return finished;

					var wrapped = Converter._variableWrapLength( finished);
					//console.log("wrapped", wrapped);

					return wrapped;
				}

			}
		},
		"binary": {
			"array": function ConverterBinaryToArray(bin, wrap) { //TODO PADDING NOT GOOD
				var typeDef = DataType("array");

				//console.log("wrapped", bin);
				if (wrap !== false)
					bin = Converter._variableUnwrapLength( bin);
				//console.log("unwrapped", bin);

				var binArrayIdentifier = bin.substr(0, 4);
				var binPaddingLen = bin.substr(4 , 2);

				var arrayIdentifier = Converter._converters['binary'][ 'half' ]( binArrayIdentifier );
				var paddingLength = BinaryToNumber( binPaddingLen, 2 );

				var dataStart = 4 + 2 + paddingLength;
				var dataLength = bin.length - dataStart;

				var binItems = bin.substr(dataStart, dataLength );

				var arrayItemType = DataType(arrayIdentifier);
				var isVariableArray = arrayItemType.name == "variable";

				var rtn = [];
				if (isVariableArray) {

				} else {
					var hasVariableLengthChildren = arrayItemType.size == "variable";
					if (hasVariableLengthChildren) {
						var VLDS = DataType.VARIABLELENGTHDESCRIPTORSIZE;
						while ( binItems != "" ) {
							
							var variableLength = Converter._variableLength( binItems );
							var binItem = binItems.substr(0, VLDS + variableLength);
							binItems = binItems.substr(VLDS+variableLength);
							//console.log("binItem", binItem, BinaryToNumber(binItem, 16));

							rtn.push( Converter._converters['binary'][ arrayItemType.name ]( binItem) );
						}
					} else {
						while ( binItems != "" ) {
							var binItem = binItems.substr(0, arrayItemType.length);
							binItems = binItems.substr(arrayItemType.length);

							rtn.push( Converter._converters['binary'][ arrayItemType.name ](binItem) );
						}
					}

				}


				return rtn;

			},
			"base64": function ConverterBinaryToBase64(bin) { //TODO PADDING NOT GOOD
				var paddingLength = 0;
				if (bin.length % 6) paddingLength = 6 - (bin.length % 6);
				binPaddingLen = NumberToBinary(paddingLength, 6);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

				var binLength = bin.length;
			    var base64 = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*6 >= binLength) break;
			     
			        var block = bin.substr(b*6,6);
			        base64 += Base64(parseInt(block, 2));
			    }

			    return base64;
			},
			"base16": function ConverterBinaryToBase16(bin) {
				var paddingLength = 0;
				if (bin.length % 4) paddingLength = 4 - (bin.length % 4);
				binPaddingLen = NumberToBinary(paddingLength, 4);
				binPadding = Padding.addLeft("", paddingLength);
				bin = binPaddingLen + binPadding + bin;

			    var binLength = bin.length;
			    var hex = "";
			    for (var b = 0; b < 10000; b++) {
			        if (b*4 >= binLength) break;
			     
			        var block = bin.substr(b*4,4);
			        hex += parseInt(block, 2).toString(16);
			    }
			    return hex;
			},
			"double": function ConverterBinaryToDouble(bin, wrap) {
				var typeDef = DataType("double");
				
				if (wrap !== false)
					bin = Converter._variableUnwrapLength(bin);

				var isMinus = bin.substr(0 ,1) == 1;

				var exponentByte = parseInt("0" + bin.substr(1, 7), 2);
				var baseLong = parseInt( bin.substr(8, bin.length), 2);

				var dbl = parseFloat(baseLong+"E-"+exponentByte, 10);
				if (isMinus) dbl = dbl * -1;

				return dbl;
			},
			"long": function ConverterBinaryToLong(bin) {
				return parseInt(bin.substr(0, 32), 2);
			},
			"short": function ConverterBinaryToShort(bin) {
				return parseInt(bin.substr(0, 16), 2);
			},
			"byte": function ConverterBinaryToByte(bin) {
				return parseInt(bin.substr(0, 8), 2);
			},
			"half": function ConverterBinaryToHalf(bin) {
				return parseInt(bin.substr(0, 4), 2);
			},
			"boolean": function ConverterBinaryToBoolean(bin) {
				return bin.substr(0,1) == "1" ? true: false;
			},
			"number": function ConverterBinaryToNumber(bin) {
				return parseInt(bin, 2);
			}
		}
	};
	
	window.SCORMSuspendData = {
		serialize: function SCORMSuspendDataSerialize(arr) {
			return Converter ("array", "base64", arr);
		},
		deserialize: function SCORMSuspendDataDeserialize(base64) {
			return Converter("base64", "array", base64);
		},
		Base64: Base64,
		Converter: Converter,
		DataType: DataType
	};


})(_);

define("extensions/adapt-contrib-spoor/js/serializers/scormSuspendDataSerializer", function(){});

define('extensions/adapt-contrib-spoor/js/serializers/questions',[
    'coreJS/adapt',
    './scormSuspendDataSerializer'
], function (Adapt) {

    //Captures the completion status and user selections of the question components
    //Returns and parses a base64 style string
    var includes = {
        "_isQuestionType": true,
        "_isResetOnRevisit": false
    };

    var serializer = {
        serialize: function () {
            return this.serializeSaveState();
        },

        serializeSaveState: function() {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
                return "";
            }

            var rtn = "";
            try {
                var data = this.captureData();
                if (data.length === 0) return "";
                rtn = SCORMSuspendData.serialize(data);
            } catch(e) {
                console.error(e);
            }

            return rtn;
        },

        captureData: function() {
            var data = [];
            
            var trackingIds = Adapt.blocks.pluck("_trackingId");
            var blocks = {};
            var countInBlock = {};

            for (var i = 0, l = trackingIds.length; i < l; i++) {

                var trackingId = trackingIds[i];
                var blockModel = Adapt.blocks.findWhere({_trackingId: trackingId });
                var componentModels = blockModel.getChildren().where(includes);

                for (var c = 0, cl = componentModels.length; c < cl; c++) {

                    var component = componentModels[c].toJSON();
                    var blockId = component._parentId;

                    if (!blocks[blockId]) {
                        blocks[blockId] = blockModel.toJSON();
                    }

                    var block = blocks[blockId];
                    if (countInBlock[blockId] === undefined) countInBlock[blockId] = -1;
                    countInBlock[blockId]++;

                    var blockLocation = countInBlock[blockId];

                    if (component['_isInteractionComplete'] === false || component['_isComplete'] === false) {
                        //if component is not currently complete skip it
                        continue;
                    }

                    var hasUserAnswer = (component['_userAnswer'] !== undefined);
                    var isUserAnswerArray = (component['_userAnswer'] instanceof Array);


                    var numericParameters = [
                            blockLocation,
                            block['_trackingId'],
                            component['_score'] || 0,
                            component['_attemptsLeft'] || 0
                        ];

                    var booleanParameters = [
                            hasUserAnswer,
                            isUserAnswerArray,
                            component['_isInteractionComplete'],
                            component['_isSubmitted'],
                            component['_isCorrect'] || false
                        ];

                    var dataItem = [
                        numericParameters,
                        booleanParameters
                    ];


                    if (hasUserAnswer) {
                        var userAnswer = isUserAnswerArray ? component['_userAnswer'] : [component['_userAnswer']];

                        var arrayType = SCORMSuspendData.DataType.getArrayType(userAnswer);

                        switch(arrayType.name) {
                        case "string": case "variable":
                            console.log("Cannot store _userAnswers from component " + component._id + " as array is of variable or string type.");
                            continue;
                        }

                        dataItem.push(userAnswer);
                    }

                    data.push(dataItem);

                }

            }

            return data;

        },

        deserialize: function (str) {

            try {
                var data = SCORMSuspendData.deserialize(str);
                this.releaseData( data );
            } catch(e) {
                console.error(e);
            }
            
        },    

        releaseData: function (arr) {
            
            for (var i = 0, l = arr.length; i < l; i++) {
                var dataItem = arr[i];

                var numericParameters = dataItem[0];
                var booleanParameters = dataItem[1];

                var blockLocation = numericParameters[0];
                var trackingId = numericParameters[1];
                var score = numericParameters[2];
                var attemptsLeft = numericParameters[3] || 0;

                var hasUserAnswer = booleanParameters[0];
                var isUserAnswerArray = booleanParameters[1];
                var isInteractionComplete = booleanParameters[2];
                var isSubmitted = booleanParameters[3];
                var isCorrect = booleanParameters[4];

                var block = Adapt.blocks.findWhere({_trackingId: trackingId});
                var components = block.getChildren();
                components = components.where(includes);
                var component = components[blockLocation];

                component.set("_isComplete", true);
                component.set("_isInteractionComplete", isInteractionComplete);
                component.set("_isSubmitted", isSubmitted);
                component.set("_score", score);
                component.set("_isCorrect", isCorrect);
                component.set("_attemptsLeft", attemptsLeft);

                if (hasUserAnswer) {
                    var userAnswer = dataItem[2];
                    if (!isUserAnswerArray) userAnswer = userAnswer[0];

                    component.set("_userAnswer", userAnswer);
                }


            }
        }
    };

    return serializer;
});

define('extensions/adapt-contrib-spoor/js/adapt-stateful-session',[
	'coreJS/adapt',
	'./serializers/default',
	'./serializers/questions'
], function(Adapt, serializer, questions) {

	//Implements Adapt session statefulness
	
	var AdaptStatefulSession = _.extend({

		_sessionID: null,
		_config: null,
		_shouldStoreResponses: false,
		_shouldRecordInteractions: true,

	//Session Begin
		initialize: function() {
			this.getConfig();
			this.restoreSessionState();
			this.assignSessionId();
			this.setupEventListeners();
		},

		getConfig: function() {
			this._config = Adapt.config.has('_spoor')
				? Adapt.config.get('_spoor')
				: false;
			
			this._shouldStoreResponses = (this._config && this._config._tracking && this._config._tracking._shouldStoreResponses);
			
			// default should be to record interactions, so only avoid doing that if _shouldRecordInteractions is set to false
			if (this._config && this._config._tracking && this._config._tracking._shouldRecordInteractions === false) {
				this._shouldRecordInteractions = false;
			}
		},

		saveSessionState: function() {
			var sessionPairs = this.getSessionState();
			Adapt.offlineStorage.set(sessionPairs);
		},

		restoreSessionState: function() {
			var sessionPairs = Adapt.offlineStorage.get();
			var hasNoPairs = _.keys(sessionPairs).length === 0;

			if (hasNoPairs) return;

			if (sessionPairs.completion) serializer.deserialize(sessionPairs.completion);
			if (sessionPairs.questions && this._shouldStoreResponses) questions.deserialize(sessionPairs.questions);
			if (sessionPairs._isCourseComplete) Adapt.course.set('_isComplete', sessionPairs._isCourseComplete);			
			if (sessionPairs._isAssessmentPassed) Adapt.course.set('_isAssessmentPassed', sessionPairs._isAssessmentPassed);
		},

		getSessionState: function() {
			var sessionPairs = {
				"completion": serializer.serialize(),
				"questions": (this._shouldStoreResponses == true ? questions.serialize() : ""),
				"_isCourseComplete": Adapt.course.get("_isComplete") || false,
				"_isAssessmentPassed": Adapt.course.get('_isAssessmentPassed') || false
			};
			return sessionPairs;
		},

		assignSessionId: function () {
			this._sessionID = Math.random().toString(36).slice(-8);
		},

	//Session In Progress
		setupEventListeners: function() {
			this._onWindowUnload = _.bind(this.onWindowUnload, this);
			$(window).on('unload', this._onWindowUnload);

			if (this._shouldStoreResponses) {
				this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onQuestionComponentComplete);
			}

			if(this._shouldRecordInteractions) {
				this.listenTo(Adapt, 'questionView:recordInteraction', this.onQuestionRecordInteraction);
			}

			this.listenTo(Adapt.blocks, 'change:_isComplete', this.onBlockComplete);
			this.listenTo(Adapt.course, 'change:_isComplete', this.onCompletion);
			this.listenTo(Adapt, 'assessment:complete', this.onAssessmentComplete);
			this.listenTo(Adapt, 'questionView:complete', this.onQuestionComplete);
			this.listenTo(Adapt, 'questionView:reset', this.onQuestionReset);
		},

		onBlockComplete: function(block) {
			this.saveSessionState();
		},

		onQuestionComponentComplete: function(component) {
			if (!component.get("_isQuestionType")) return;

			this.saveSessionState();
		},

		onCompletion: function() {
			if (!this.checkTrackingCriteriaMet()) return;

			this.saveSessionState();
			
			Adapt.offlineStorage.set("status", this._config._reporting._onTrackingCriteriaMet);
		},

		onAssessmentComplete: function(stateModel) {
			Adapt.course.set('_isAssessmentPassed', stateModel.isPass)
			
			this.saveSessionState();

			this.submitScore(stateModel.scoreAsPercent);

			if (stateModel.isPass) {
				this.onCompletion();
			} else if (this._config && this._config._tracking._requireAssessmentPassed) {
				this.submitAssessmentFailed();
			}
		},

		onQuestionRecordInteraction:function(questionView) {
			var id = questionView.model.get('_id');
			var latency = questionView.getLatency();
			var response = questionView.getResponse();
			var responseType = questionView.getResponseType();
			var result = questionView.isCorrect();
			
			Adapt.offlineStorage.set("interaction", id, response, result, latency, responseType);
		},

		submitScore: function(score) {
			if (this._config && !this._config._tracking._shouldSubmitScore) return;
			
			Adapt.offlineStorage.set("score", score, 0, 100);
		},

		submitAssessmentFailed: function() {
			if (this._config && this._config._reporting.hasOwnProperty("_onAssessmentFailure")) {
				var onAssessmentFailure = this._config._reporting._onAssessmentFailure;
				if (onAssessmentFailure === "") return;
					
				Adapt.offlineStorage.set("status", onAssessmentFailure);
			}
		},

		onQuestionComplete: function(questionView) {
			questionView.model.set('_sessionID', this._sessionID);
		},

		onQuestionReset: function(questionView) {
			if (this._sessionID !== questionView.model.get('_sessionID')) {
				questionView.model.set('_isEnabledOnRevisit', true);
			}
		},
		
		checkTrackingCriteriaMet: function() {
			var criteriaMet = false;

			if (!this._config) {
				return false;
			}

			if (this._config._tracking._requireCourseCompleted && this._config._tracking._requireAssessmentPassed) { // user must complete all blocks AND pass the assessment
				criteriaMet = (Adapt.course.get('_isComplete') && Adapt.course.get('_isAssessmentPassed'));
			} else if (this._config._tracking._requireCourseCompleted) { //user only needs to complete all blocks
				criteriaMet = Adapt.course.get('_isComplete');
			} else if (this._config._tracking._requireAssessmentPassed) { // user only needs to pass the assessment
				criteriaMet = Adapt.course.get('_isAssessmentPassed');
			}

			return criteriaMet;
		},

	//Session End
		onWindowUnload: function() {
			$(window).off('unload', this._onWindowUnload);

			this.stopListening();
		}
		
	}, Backbone.Events);

	return AdaptStatefulSession;

});

define('extensions/adapt-contrib-spoor/js/adapt-offlineStorage-scorm',[
	'coreJS/adapt',
	'./scorm',
	'coreJS/offlineStorage'
], function(Adapt, scorm) {

	//SCORM handler for Adapt.offlineStorage interface.

	//Stores to help handle posting and offline uniformity
	var temporaryStore = {};
	var suspendDataStore = {};
	var suspendDataRestored = false;

	Adapt.offlineStorage.initialize({

		get: function(name) {
			if (name === undefined) {
				//If not connected return just temporary store.
				if (this.useTemporaryStore()) return temporaryStore;

				//Get all values as a combined object
				suspendDataStore = this.getCustomStates();

				var data = _.extend(_.clone(suspendDataStore), {
					location: scorm.getLessonLocation(),
					score: scorm.getScore(),
					status: scorm.getStatus(),
					student: scorm.getStudentName()
				});

				suspendDataRestored = true;
				
				return data;
			}

			//If not connected return just temporary store value.
			if (this.useTemporaryStore()) return temporaryStore[name];

			//Get by name
			switch (name.toLowerCase()) {
				case "location":
					return scorm.getLessonLocation();
				case "score":
					return scorm.getScore();
				case "status":
					return scorm.getStatus();
				case "student":
					return scorm.getStudentName();
				default:
					return this.getCustomState(name);
			}
		},

		set: function(name, value) {
			//Convert arguments to array and drop the 'name' parameter
			var args = [].slice.call(arguments, 1);
			var isObject = typeof name == "object";

			if (isObject) {
				value = name;
				name = "suspendData";
			}

			if (this.useTemporaryStore()) {
				if (isObject) {
					temporaryStore = _.extend(temporaryStore, value);
				} else {
					temporaryStore[name] = value;
				}

				return true;
			}

			switch (name.toLowerCase()) {
				case "interaction":
					return scorm.recordInteraction.apply(scorm, args);
				case "location":
					return scorm.setLessonLocation.apply(scorm, args);
				case "score":
					return scorm.setScore.apply(scorm, args);
				case "status":
					return scorm.setStatus.apply(scorm, args);
				case "student":
					return false;
				case "suspenddata":
				default:
					if (isObject) {
						suspendDataStore = _.extend(suspendDataStore, value);
					} else {
						suspendDataStore[name] = value;
					}

					var dataAsString = JSON.stringify(suspendDataStore);
					return (suspendDataRestored) ? scorm.setSuspendData(dataAsString) : false;
			}
		},

		getCustomStates: function() {
			var isSuspendDataStoreEmpty = _.isEmpty(suspendDataStore);
			if (!isSuspendDataStoreEmpty && suspendDataRestored) return _.clone(suspendDataStore);

			var dataAsString = scorm.getSuspendData();
			if (dataAsString === "" || dataAsString === " " || dataAsString === undefined) return {};

			var dataAsJSON = JSON.parse(dataAsString);
			if (!isSuspendDataStoreEmpty && !suspendDataRestored) dataAsJSON = _.extend(dataAsJSON, suspendDataStore);
			return dataAsJSON;
		},

		getCustomState: function(name) {
			var dataAsJSON = this.getCustomStates();
			return dataAsJSON[name];
		},
		
		useTemporaryStore: function() {
			var cfg = Adapt.config.get('_spoor');
			
			if (!scorm.lmsConnected || (cfg && cfg._isEnabled === false)) return true;
			return false;
		}
		
	});

});

define('extensions/adapt-contrib-spoor/js/adapt-contrib-spoor',[
  'coreJS/adapt',
  './scorm',
  './adapt-stateful-session',
  './adapt-offlineStorage-scorm'
], function(Adapt, scorm, adaptStatefulSession) {

  //SCORM session manager

  var Spoor = _.extend({

    _config: null,

  //Session Begin

    initialize: function() {
      this.listenToOnce(Adapt, "configModel:dataLoaded", this.onConfigLoaded);
      this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
    },

    onConfigLoaded: function() {
      if (!this.checkConfig()) return;

      this.configureAdvancedSettings();

      scorm.initialize();

      this.setupEventListeners();
    },

    onDataReady: function() {
      adaptStatefulSession.initialize();
    },

    checkConfig: function() {
      this._config = Adapt.config.has('_spoor') 
        ? Adapt.config.get('_spoor')
        : false;

      if (this._config && this._config._isEnabled !== false) return true;
      
      return false;
    },

    configureAdvancedSettings: function() {
      if(this._config._advancedSettings) {
        var settings = this._config._advancedSettings;

        if(settings._showDebugWindow) scorm.showDebugWindow();

        scorm.setVersion(settings._scormVersion || "1.2");

        if(settings.hasOwnProperty("_suppressErrors")) {
          scorm.suppressErrors = settings._suppressErrors;
        }

        if(settings.hasOwnProperty("_commitOnStatusChange")) {
          scorm.commitOnStatusChange = settings._commitOnStatusChange;
        }

        if(settings.hasOwnProperty("_timedCommitFrequency")) {
          scorm.timedCommitFrequency = settings._timedCommitFrequency;
        }

        if(settings.hasOwnProperty("_maxCommitRetries")) {
          scorm.maxCommitRetries = settings._maxCommitRetries;
        }

        if(settings.hasOwnProperty("_commitRetryDelay")) {
          scorm.commitRetryDelay = settings._commitRetryDelay;
        }
      } else {
        /**
        * force use of SCORM 1.2 by default - some LMSes (SABA/Kallidus for instance) present both APIs to the SCO and, if given the choice,
        * the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
        */
        scorm.setVersion("1.2");
      }

      /**
      * suppress SCORM errors if 'nolmserrors' is found in the querystring
      */
      if(window.location.search.indexOf('nolmserrors') != -1) scorm.suppressErrors = true;
    },

    setupEventListeners: function() {
      this._onWindowUnload = _.bind(this.onWindowUnload, this);
      $(window).on('unload', this._onWindowUnload);
    },

  //Session End

    onWindowUnload: function() {
      scorm.finish();

      $(window).off('unload', this._onWindowUnload);
    }
    
  }, Backbone.Events);

  Spoor.initialize();

});

define('extensions/adapt-contrib-trickle/js/Defaults/DefaultTrickleConfig',[],function() {

	var DefaultTrickleConfig = {
		_isEnabled: true,
		_scrollDuration: 500,
		_autoScroll: true,
		_onChildren: true,
		_button: {
			_isEnabled: true,
			_isFullWidth: true,
			_styleBeforeCompletion: "hidden",
			_styleAfterClick: "hidden",
			_autoHide: true,
			text: "Continue",
			_component: "trickle-button"
		},
		_stepLocking: {
	        _isEnabled: true, 
	        _isCompletionRequired: true,
	        _isLockedOnRevisit: false
	    },
	    _isInteractionComplete: false,
	    _scrollTo: "@block +1"
	};

	return DefaultTrickleConfig;
});
define('extensions/adapt-contrib-trickle/js/DataTypes/StructureType',[],function() {
	
	function StructureType(id, plural, level) {
		this._id = id;
		this._plural = plural;
		this._level = level;
		StructureType.levels+=1;
	}
	StructureType.levels = 0;

	StructureType.prototype = {};

	StructureType.prototype.toString = function() {
		return this._id;
	};

	StructureType.fromString = function(value) {
		switch (value) {
		case StructureType.Page._id: case StructureType.Page._plural:
			return StructureType.Page;
		case StructureType.Article._id: case StructureType.Article._plural:
			return StructureType.Article;
		case StructureType.Block._id: case StructureType.Block._plural:
			return StructureType.Block;
		case StructureType.Component._id: case StructureType.Component._plural:
			return StructureType.Component;
		}
	};

	StructureType.fromInt = function(value) {
		switch (value) {
		case StructureType.Page._level: 
			return StructureType.Page;
		case StructureType.Article._level: 
			return StructureType.Article;
		case StructureType.Block._level: 
			return StructureType.Block;
		case StructureType.Component._level: 
			return StructureType.Component;
		}
	};

	StructureType.Page = new StructureType("page", "pages", 1);
	StructureType.Article = new StructureType("article", "articles", 2);
	StructureType.Block = new StructureType("block", "blocks", 3);
	StructureType.Component = new StructureType("component", "components", 4);

	return StructureType;

});
define('extensions/adapt-contrib-trickle/js/Utility/Models',[
    'coreJS/adapt',
    '../DataTypes/StructureType'
], function(Adapt, StructureType) {

    var ModelUtilities = {
        
        /*
        * Fetchs the sub structure of an id as a flattened array
        *
        *   Such that the tree:
        *       { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
        *
        *   will become the array (parent first = false):
        *       [ c1, c2, b1, c3, c4, b2, a1, c5, c6, b3, a2 ]
        *
        *   or (parent first = true):
        *       [ a1, b1, c1, c2, b2, c3, c4, a2, b3, c5, c6 ]
        *
        * This is useful when sequential operations are performed on the page/article/block/component hierarchy.
        */
        getDescendantsFlattened: function(id, parentFirst) {
            var model = Adapt.findById(id);
            if (model === undefined) return undefined;

            var descendants = [];

            var modelStructureType = StructureType.fromString(model.get("_type"));
            var isLastType = (modelStructureType._level === StructureType.levels);

            if (isLastType) {
                descendants.push(model);
                return new Backbone.Collection(descendants);
            }

            var children = model.getChildren();

            for (var i = 0, l = children.models.length; i < l; i++) {

                var child = children.models[i];

                var modelStructureType = StructureType.fromString(child.get("_type"));
                var isLastType = (modelStructureType._level === StructureType.levels);

                if (isLastType) {

                    descendants.push(child);

                } else {

                    var subDescendants = ModelUtilities.getDescendantsFlattened(child.get("_id"), parentFirst);
                    if (parentFirst == true) descendants.push(child);
                    descendants = descendants.concat(subDescendants.models);
                    if (parentFirst != true) descendants.push(child);

                }

            }

            return new Backbone.Collection(descendants);
        },

        /*
        * Returns a relative structural item from the Adapt hierarchy
        *   
        *   Such that in the tree:
        *       { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
        *
        *       findRelative(modelC1, "@block +1") = modelB2;
        *       findRelative(modelC1, "@component +4") = modelC5;
        *
        */
        findRelative: function(model, relativeString) {
            //return a model relative to the specified one
            var pageModel;
            if (model.get("_type") == "page") pageModel = model;
            else pageModel = model.findAncestor("contentObjects");

            var pageId = pageModel.get("_id");
            var pageDescendants = ModelUtilities.getDescendantsFlattened(pageId).toJSON();

            function parseRelative(relativeString) {
                var type = relativeString.substr(0, _.indexOf(relativeString, " "));
                var offset = parseInt(relativeString.substr(type.length));
                type = type.substr(1);

                /*RETURN THE TYPE AND OFFSET OF THE SCROLLTO
                * "@component +1"  : 
                * {
                *       type: "component",
                *       offset: 1
                * }
                */
                return { 
                    type: type,
                    offset: offset
                };
            }

            function getTypeOffset(model) {
                var modelType = StructureType.fromString(model.get("_type"));

                //CREATE HASH FOR MODEL OFFSET IN PARENTS ACCORDING TO MODEL TYPE
                var offsetCount = {};
                for (var i = modelType._level - 1, l = 0; i > l; i--) {
                    offsetCount[StructureType.fromInt(i)._id] = -1;
                }

                return offsetCount;
            }

            var pageDescendantIds = _.pluck(pageDescendants, "_id");

            var modelId = model.get("_id");
            var fromIndex = _.indexOf( pageDescendantIds, modelId );

            var typeOffset = getTypeOffset(model);
            var relativeInstructions = parseRelative(relativeString);

            for (var i = fromIndex +1, l = pageDescendants.length; i < l; i++) {
                var item = pageDescendants[i];

                if (!typeOffset[item._type]) typeOffset[item._type] = 0;

                typeOffset[item._type]++;

                if (typeOffset[relativeInstructions.type] >= relativeInstructions.offset) {
                    if (!$("."+item._id).is(":visible")) {
                        //IGNORE VISIBLY HIDDEN ELEMENTS
                        relativeInstructions.offset++;
                        continue;
                    }

                    return Adapt.findById(item._id);
                }
            }

            return undefined;
        },

        isLastStructureType: function(model) {
            var modelStructureType = StructureType.fromString(model.get("_type"));
            var isLastType = (modelStructureType._level === StructureType.levels);
            return isLastType;
        }
    };

    return ModelUtilities;

});

define('extensions/adapt-contrib-trickle/js/trickle-tutorPlugin',[
    'coreJS/adapt', 
], function(Adapt) {

    var TrickleTutorPlugin = _.extend({

        onDataReady: function() {
            this.setupEventListeners();
        },

        onStepLockingWaitCheck: function(model) {
            if ( model.get("_type") !== "component" || !model.get("_isQuestionType") || !model.get("_canShowFeedback")) return;

            if (this._isTrickleWaiting) return;
            Adapt.trigger("steplocking:wait");
            this._isTrickleWaiting = true;
        },

        onTutorOpened: function() {
            if (this._isTrickleWaiting) return;
            Adapt.trigger("steplocking:wait");
        },

        onTutorClosed: function() {

            if (!this._isTrickleWaiting) return;

            Adapt.trigger("steplocking:unwait");
            this._isTrickleWaiting = false;
        },

        _isTrickleWaiting: false,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
        },

        setupEventListeners: function() {
            this.listenTo(Adapt, "steplocking:waitCheck", this.onStepLockingWaitCheck);
            this.listenTo(Adapt, "tutor:open", this.onTutorOpened);
            this.listenTo(Adapt, "tutor:closed", this.onTutorClosed);
        }

    }, Backbone.Events);

    TrickleTutorPlugin.initialize();

})
;
define('extensions/adapt-contrib-trickle/js/trickle-buttonView',[
    'coreJS/adapt',
    'coreViews/componentView'
], function(Adapt, ComponentView) {

    var completionAttribute = "_isInteractionComplete";

    var TrickleButtonView = ComponentView.extend({

        onEnabledChange: function(model, value) {
            this.setDisabledState(!value);
        },

        onSteplockingCheckWait: function(parentModel) {
            this.checkCurrentInteraction(parentModel);
        },

        onInteractionRequired: function(parentModel) {
            this.showButton(parentModel); 
        },

        onOnScreen: function() {
            //show or hide the button when button is inview/outview
            this.checkAutoHide( this.isOnScreen() );
        },

        onClick: function() {
            if (!this.model.get("_isLocking")) {
                this.completeJump();
            } else {
                this.completeLock();
            }
        },

        onRemove: function() {
            this.undelegateEvents();
            this.$el.remove();
        },

        events: {
            "click .trickle-button-inner > *": "onClick",
            "onscreen": "onOnScreen"
        },

        _isTrickleWaiting: false,

        initialize: function() {
            var trickleConfig = Adapt.config.get("_trickle");
            if (trickleConfig && trickleConfig._completionAttribute) completionAttribute = trickleConfig._completionAttribute;

            this.addCustomClasses();
            ComponentView.prototype.initialize.apply(this);

            this.model.set("_isEnabled", this.isInEnabledState());

            this.checkAutoHide(this.isInVisibleState(), false);
        },

        addCustomClasses: function() {
            if (!this.model.get("_trickle")._button || !this.model.get("_trickle")._button._className) return;
            
            this.$el.addClass(this.model.get("_trickle")._button._className);
        },

        postRender: function() {
            this.setDisabledState( !this.isInEnabledState() );

            this.setReadyStatus();
            this.setupEventListeners();
        },

        setDisabledState: function(bool) {
            if (bool) this.$el.find(".trickle-button-inner > *").addClass("disabled").attr("disabled","disabled");
            else this.$el.find(".trickle-button-inner > *").removeClass("disabled").removeAttr("disabled");
        },

        setupEventListeners: function() {

            var trickleConfig = this.model.get("_trickle");
            if (!trickleConfig._button._autoHide) this.$el.off("onscreen");

            this.listenTo(Adapt, "trickle:interactionRequired", this.onInteractionRequired);
            this.listenTo(Adapt, "steplocking:waitCheck", this.onSteplockingCheckWait);
            this.listenTo(this.model, "change:_isEnabled", this.onEnabledChange);
            this.listenTo(this.model, "change:_isVisible", this.onVisibilityChange);
            this.listenToOnce(Adapt, "remove", this.onRemove);
            this.listenToOnce(Adapt, "trickle:kill", this.onRemove);
        },

        toggleLock: function(bool) {
            if (!this.isStepLockingEnabled()) return;

            var trickleConfig = this.model.get("_trickle");

            if (bool) {

                this.$el.find('.component-inner').addClass("locking");

                this.model.set("_isLocking", true);

                this.steplockingWait();

            } else {

                this.$el.find('.component-inner').removeClass("locking");

                this.model.set("_isLocking", false);

                this.steplockingUnwait();
            }
        },

        isStepLockingEnabled: function() {
            var trickleConfig = this.model.get("_trickle");
            if (trickleConfig && trickleConfig._stepLocking && trickleConfig._stepLocking._isEnabled) {
                return true;
            }
            return false;
        },

        steplockingWait: function() {
            if (!this._isTrickleWaiting) Adapt.trigger("steplocking:wait");
            this._isTrickleWaiting = true;
        },

        steplockingUnwait: function() {
            if (this._isTrickleWaiting) Adapt.trigger("steplocking:unwait");
            this._isTrickleWaiting = false;
        },

        checkCurrentInteraction: function(parentModel) {
            if (parentModel.get("_id") != this.model.get("_parentId")) return;

            var trickleConfig = this.model.get("_trickle");

            if (trickleConfig._isInteractionComplete) return;

            this.model.set("_isEnabled", this.isInEnabledState() );
        },

        showButton: function(parentModel) {
            //check if the interaction required event is intended for this button
            if (parentModel.get("_id") != this.model.get("_parentId")) return;

            var trickleConfig = this.model.get("_trickle");

            if (trickleConfig._isInteractionComplete) return;

            this.model.set("_isEnabled",  this.isInEnabledState() );

            this.toggleLock(true);

            this.checkAutoHide(true, true);
        },

        checkAutoHide: function(bool, animate) {
            
            if (!this.isInVisibleState()) {
                //override visible state if button should not be visible
                bool = false;
            }

            this.model.set("_isVisible", bool);

            var trickleConfig = this.model.get("_trickle");
            if (!trickleConfig._button._autoHide) return;

            if (this.model.get("_isHidden") == bool) return;

            this.model.set("_isHidden", bool);

            if (animate === false || Adapt.config.get('_disableAnimation')) {
                //show or hide without animations
                if (!bool) this.$('.component-inner').css("visibility", "hidden");
                else if (bool) this.$('.component-inner').css("visibility", "visible");
            } else {
                //perform animation from visible<>hidden
                if (bool) this.$('.component-inner').css("visibility", "visible");
                this.$('.component-inner').velocity("stop", true).velocity({opacity: bool ? 1 : 0 }, {
                    duration: 250,
                    complete: _.bind(function() {
                        if (!bool) this.$('.component-inner').css("visibility", "hidden");
                    }, this)
                })
            }
            
        },

        isInEnabledState: function() {
            var trickleConfig = this.model.get("_trickle");

            var _isEnabled = true;

            var isEnabledBeforeCompletion = false;
            //Check to see if autohide component should always be visible or if it has a precompletion hidden state
            if (trickleConfig._button._styleBeforeCompletion == "visible") {
                isEnabledBeforeCompletion = (!trickleConfig._stepLocking._isEnabled || !trickleConfig._stepLocking._isCompletionRequired);
            }

            var isEnabledAfterClick = (trickleConfig._button._styleAfterClick != "hidden" && trickleConfig._button._styleAfterClick != "disabled");

            var parentModel = Adapt.findById(this.model.get("_parentId"));
            var isComplete = parentModel.get(completionAttribute);
            var isClicked = trickleConfig._isInteractionComplete;

            var isBeforeCompletionEnabled = (!isComplete && !isClicked && isEnabledBeforeCompletion);
            var isAfterCompletionEnabled = (isClicked && isEnabledAfterClick);
            var isInInteractionEnabled = (isComplete && !isClicked);

            _isEnabled = isBeforeCompletionEnabled || isAfterCompletionEnabled || isInInteractionEnabled;

            return _isEnabled;
        },

        isInVisibleState: function() {
            var trickleConfig = this.model.get("_trickle");

            var _isVisible = true;

            var isVisibleBeforeCompletion = true;
            //Check to see if autohide component should always be visible or if it has a precompletion hidden state
            if (trickleConfig._button._styleBeforeCompletion == "hidden") {
                isVisibleBeforeCompletion = (trickleConfig._button._styleBeforeCompletion != "hidden");
            }

            var isVisibleAfterClick = (trickleConfig._button._styleAfterClick != "hidden");

            var parentModel = Adapt.findById(this.model.get("_parentId"));
            var isComplete = parentModel.get(completionAttribute);
            var isClicked = trickleConfig._isInteractionComplete;

            var isOnScreen = true;
            if (trickleConfig._button._autoHide) {
                isOnScreen = this.isOnScreen();
            }

            var isBeforeCompletionVisible = (!isComplete && !isClicked && isVisibleBeforeCompletion && isOnScreen);
            var isInInteractionVisible = (isComplete && !isClicked && isOnScreen);
            var isAfterCompletionVisible = (isClicked && isVisibleAfterClick && isOnScreen);

            _isVisible = isBeforeCompletionVisible || isAfterCompletionVisible || isInInteractionVisible;


            return _isVisible;

        },

        isOnScreen: function() {
            var onscreen = false;
            var measurements = this.$el.onscreen();
            var parent = this.$el.offsetParent();
            var isParentHtml = parent.is("html");
            if (!isParentHtml && measurements.bottom > -(this.$(".component-inner").outerHeight()*2)) {
                onscreen = true;
            }
            return onscreen;
        },

        completeJump: function() {

            var trickleConfig = this.model.get("_trickle");
            trickleConfig._isInteractionComplete = true;

            this.updateState();

            this.scrollTo();
        },

        updateState: function() {

            var trickleConfig = this.model.get("_trickle");

            switch (trickleConfig._button._styleAfterClick) {
            case "disabled": case "hidden":
                this.model.set("_isEnabled", this.isInEnabledState() );
                this.$el.off("onscreen");
                this.stopListening();
                break;
            case "scroll":
                this.model.set("_isEnabled", this.isInEnabledState() );
                break;
            }

            this.checkAutoHide(true, true);
        },

        scrollTo: function() {
            var trickleConfig = this.model.get("_trickle");
            var scrollTo = trickleConfig._scrollTo;
            var parentModel = Adapt.findById(this.model.get("_parentId"));
            Adapt.trigger("trickle:relativeScrollTo", parentModel, scrollTo);
        },

        completeLock: function() {

            var trickleConfig = this.model.get("_trickle");
            trickleConfig._isInteractionComplete = true;

            this.toggleLock(false);

            //as this is an 'out-of-course' component, 
            //we must manually ask trickle to consider the completion of its parent (possibly for a second time)
            var parentModel = Adapt.findById(this.model.get("_parentId"));
            Adapt.trigger("trickle:interactionComplete", parentModel);
            
            this.updateState();
        }

    });

    Adapt.register("trickle-button", TrickleButtonView);

    return TrickleButtonView;
});

define('extensions/adapt-contrib-trickle/js/Defaults/FullWidthButtonConstants',[],function() {

	var FullWidthButtonConstants = {
		_stepLocking: {
			_isEnabled: true
		}
	};
	
	return FullWidthButtonConstants;
});
define('extensions/adapt-contrib-trickle/js/trickle-buttonModel',[
    'coreModels/adaptModel',
    './Defaults/FullWidthButtonConstants'
], function(AdaptModel, FullWidthButtonConstants) {

    var TrickleButtonModel = AdaptModel.extend({
        
        initialize: function(options) {
            if (options.trickleConfig === undefined) return;
            if (options.parentModel === undefined) return;

            var parentModel = options.parentModel;
            var trickleConfig = options.trickleConfig;

            var isFullWidth = (trickleConfig._button._isFullWidth);
            if (isFullWidth) {
                //setup configuration with FullWidth type constants
                $.extend(true, trickleConfig, FullWidthButtonConstants);
            }

            this.setupButtonText(trickleConfig);

            this.set({
                _id: "trickle-button-"+parentModel.get("_id"),
                _type: "component",
                _component: "trickle-button",
                //turn off accessibility state for button component
                _classes: "no-state" + (isFullWidth ? " trickle-full-width" : ""),
                _layout: "full",
                _parentId: parentModel.get("_id"),
                _parentType: parentModel.get("_type"),
                _parentComponent: parentModel.get("_component"),
                _trickle: trickleConfig,
                _isVisible: true,
                _isHidden: false,
                _isAvailable: true,
                _isEnabled: true,
                _isLocking: trickleConfig._isLocking,
                _isComplete: trickleConfig._isInteractionComplete,
                _isInteractionComplete: trickleConfig._isInteractionComplete,
                _index: trickleConfig._index
            });

        },

        setupButtonText: function(trickleConfig) {
            if (trickleConfig._isLastItem) {
                //Apply final text to last button
                if (trickleConfig._button && trickleConfig._button.finalText) {
                    var previousText = trickleConfig._button.text;

                    trickleConfig._button.text = trickleConfig._button.finalText,
                    trickleConfig._button.previousText = previousText;
                }
            } else {
                //Reset button to previous text
                if (trickleConfig && trickleConfig._button.previousText) {
                    trickleConfig._button.text = trickleConfig._button.previousText;
                    trickleConfig._button.previousText = null;
                }
            }
        }

    });

    return TrickleButtonModel;

});
define('extensions/adapt-contrib-trickle/js/trickle-buttonPlugin',[
    'coreJS/adapt',
    './trickle-buttonView',
    './trickle-buttonModel'
], function(Adapt, TrickleButtonView, TrickleButtonModel) {

    var completionAttribute = "_isInteractionComplete";

    var TrickleButtonPlugin = {
        
        onInteractionInitialize: function(model) {
            var trickleConfig = Adapt.config.get("_trickle");
            if (trickleConfig && trickleConfig._completionAttribute) completionAttribute = trickleConfig._completionAttribute;

            TrickleButtonPlugin.createButton(model);
        },

        createButton: function(model) {
            var trickleConfig = model.get("_trickle");
            if (!trickleConfig) return false;

            if (!TrickleButtonPlugin.shouldRenderButton(model, trickleConfig)) return;
            TrickleButtonPlugin.buildAndAppendButton(model, trickleConfig);
        },

        shouldRenderButton: function(model, trickleConfig) {
            if (!trickleConfig._button._isEnabled) return false;
            if (!trickleConfig._button._component == "trickle-button") return false;

            return true;
        },

        buildAndAppendButton: function(model, trickleConfig) {
            var $containerModelElement = $("." + trickleConfig._id);

            var buttonModel = new TrickleButtonModel({ 
                trickleConfig: trickleConfig, 
                parentModel: model 
            });

            var buttonView = new TrickleButtonView({ 
                model: buttonModel, 
                nthChild: "additional" 
            });

            $containerModelElement.append( buttonView.$el );
        }
    };

    Adapt.on("trickle:interactionInitialize", TrickleButtonPlugin.onInteractionInitialize);

    return TrickleButtonPlugin;
});
//https://github.com/cgkineo/jquery.resize 2015-08-13

(function() {

  if ($.fn.off.elementResizeOriginalOff) return;


  var orig = $.fn.on;
  $.fn.on = function () {
    if (arguments[0] !== "resize") return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));

    addResizeListener.call(this, (new Date()).getTime());

    return $.fn.on.elementResizeOriginalOn.apply(this, _.toArray(arguments));
  };
  $.fn.on.elementResizeOriginalOn = orig;
  var orig = $.fn.off;
  $.fn.off = function () {
    if (arguments[0] !== "resize") return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
    if (this[0] === window) return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));

    removeResizeListener.call(this, (new Date()).getTime());

    return $.fn.off.elementResizeOriginalOff.apply(this, _.toArray(arguments));
  };
  $.fn.off.elementResizeOriginalOff = orig;

  var expando = $.expando;

  //element + event handler storage
  var resizeObjs = {};

  //jQuery element + event handler attachment / removal
  var addResizeListener = function(data) {
      resizeObjs[data.guid + "-" + this[expando]] = { 
        data: data, 
        $element: $(this) 
      };
  };

  var removeResizeListener = function(data) {
    try { 
      delete resizeObjs[data.guid + "-" + this[expando]]; 
    } catch(e) {

    }
  };

  function checkLoopExpired() {
    if ((new Date()).getTime() - loopData.lastEvent > 500) {
      stopLoop()
      return true;
    }
  }

  function resizeLoop () {
    if (checkLoopExpired()) return;

    var resizeHandlers = getEventHandlers("resize");

    if (resizeHandlers.length === 0) {
      //nothing to resize
      stopLoop();
      resizeIntervalDuration = 500;
      repeatLoop();
    } else {
      //something to resize
      stopLoop();
      resizeIntervalDuration = 250;
      repeatLoop();
    }

    if  (resizeHandlers.length > 0) {
      var items = resizeHandlers;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        triggerResize(item);
      }
    }

  }

  function getEventHandlers(eventName) {
    var items = [];
    
    switch (eventName) {
    case "resize":
      for (var k in resizeObjs) {
        items.push(resizeObjs[k]);
      }
      break;
    }

    return items;
  }

  function getDimensions($element) {
      var height = $element.outerHeight();
      var width = $element.outerWidth();

      return {
        uniqueMeasurementId: height+","+width
      };
  }

  function triggerResize(item) {
    var measure = getDimensions(item.$element);
    //check if measure has the same values as last
    var isFirstRun = false;
    if (item._resizeData === undefined) isFirstRun = true;
    if (item._resizeData !== undefined && item._resizeData === measure.uniqueMeasurementId) return;
    item._resizeData = measure.uniqueMeasurementId;
    if (isFirstRun) return;
    
    //make sure to keep listening until no more resize changes are found
    loopData.lastEvent = (new Date()).getTime();
    
    item.$element.trigger('resize');
  }


  //checking loop interval duration
  var resizeIntervalDuration = 250;

  var loopData = {
    lastEvent: 0,
    interval: null
  };

  //checking loop start and end
  function startLoop() {
    loopData.lastEvent = (new Date()).getTime();
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function repeatLoop() {
    if (loopData.interval !== null) {
      stopLoop();
    }
    loopData.interval = setTimeout(resizeLoop, resizeIntervalDuration);
  }

  function stopLoop() {
    clearInterval(loopData.interval);
    loopData.interval = null;
  }

  $('body').on("mousedown mouseup keyup keydown", startLoop);
  $(window).on("resize", startLoop);


})();

define("extensions/adapt-contrib-trickle/js/lib/jquery.resize", function(){});

define('extensions/adapt-contrib-trickle/js/adapt-contrib-trickle',[
    'coreJS/adapt',
    './Defaults/DefaultTrickleConfig',
    './Utility/Models',
    './trickle-tutorPlugin',
    './trickle-buttonPlugin',
    './lib/jquery.resize'
], function(Adapt, DefaultTrickleConfig, Models) {

    var completionAttribute = "_isInteractionComplete";

    var Trickle = _.extend({

        onDataReady: function() {
            var trickleConfig = Adapt.config.get("_trickle");
            if (trickleConfig && trickleConfig._completionAttribute) completionAttribute = trickleConfig._completionAttribute;

            this.setupEventListeners();
        },

        onPagePreRender: function(view) {
            this.initializePage(view);
        },

        onArticlePreRender: function(view) {
            this.checkApplyTrickleToChildren( view.model );
        },

        onPagePostRender: function(view) {
            this.resizeBodyToCurrentIndex();
        },

        onArticleAndBlockPostRender: function(view) {
            this.setupStep( view.model );
        },

        onPageReady: function(view) {
            this.initializeStep();
            this.resizeBodyToCurrentIndex();
            this._listenToResizeEvent = true;
            this._isPageReady = true;
            Adapt.trigger("trickle:pageReady");
        },

        onAnyComplete: function(model, value, isPerformingCompletionQueue) {
            this.queueOrExecuteCompletion(model, value, isPerformingCompletionQueue);
        },

        onStepUnlockWait: function() {
            this._waitForUnlockRequestsCount++;
        },

        onStepUnlockUnwait: function() {
            this._waitForUnlockRequestsCount--;
            if (this._waitForUnlockRequestsCount < 0) this._waitForUnlockRequestsCount = 0;

            if (this._isFinished) return;

            var descendant = this.getCurrentStepModel();
            this.checkStepComplete(descendant);
        },

        onWrapperResize: function() {
            if (!this._listenToResizeEvent) {
                return;
            }

            this.resizeBodyToCurrentIndex();
            this._listenToResizeEvent = true;
        },

        onRemove: function(view) {
            this.endTrickle();
        },


        model: new Backbone.Model({}),

        _listenToResizeEvent: false,
        _isPageInitialized: false,
        _isPageReady: false,
        _isFinished: false,
        _currentStepIndex: 0,
        _descendantsChildrenFirst: null,
        _descendantsParentFirst: null,
        _pageView: null,
        _isTrickleOn: false,

        initialize: function() {
            this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
        },

        setupEventListeners: function() {
            this._onWrapperResize = _.bind(Trickle.onWrapperResize, Trickle);
            $("#wrapper").on('resize', this._onWrapperResize );

            this.listenTo(Adapt, "remove", this.onRemove);
            this.listenTo(Adapt, "pageView:preRender", this.onPagePreRender);
            this.listenTo(Adapt, "pageView:postRender", this.onPagePostRender);
            this.listenTo(Adapt, "pageView:ready", this.onPageReady);

            this.listenTo(Adapt, "articleView:preRender", this.onArticlePreRender);
            this.listenTo(Adapt, "blockView:postRender articleView:postRender", this.onArticleAndBlockPostRender);

            this.listenTo(Adapt.articles, "change:"+completionAttribute, this.onAnyComplete);
            this.listenTo(Adapt.blocks, "change:"+completionAttribute, this.onAnyComplete);
            this.listenTo(Adapt.components, "change:"+completionAttribute, this.onAnyComplete);           

            this.listenTo(Adapt, "trickle:interactionComplete", this.checkStepComplete);

            this.listenTo(Adapt, "steplocking:wait", this.onStepUnlockWait);
            this.listenTo(Adapt, "steplocking:unwait", this.onStepUnlockUnwait);

            this.listenTo(Adapt, "trickle:relativeScrollTo", this.relativeScrollTo);

            this.listenTo(Adapt, "trickle:kill", this.endTrickle);
        },

        initializePage: function(view) {
            var pageId = view.model.get("_id");

            var pageConfig = Adapt.course.get("_trickle");
            if (pageConfig && pageConfig._isEnabled === false) return;

            this._descendantsChildrenFirst =  Models.getDescendantsFlattened(pageId);
            this._descendantsParentFirst = Models.getDescendantsFlattened(pageId, true);
            this._currentStepIndex = 0;
            this._isFinished = false;
            this._listenToResizeEvent = false;
            this._pageView = view;

            this.checkResetChildren();

            this.initializeStepUnlockWait();

            this._isPageInitialized = true;

        },

        checkResetChildren: function() {
            var descendantsChildrenFirst = this._descendantsChildrenFirst;
            for (var i = 0, model; model = descendantsChildrenFirst.models[i++];) {
                this.checkResetModel(model);
            }
        },

        checkResetModel: function(model) {
            var trickleConfig = this.getModelTrickleConfig(model);
            if (!trickleConfig) return;
            if (trickleConfig._onChildren) return;

            if (!trickleConfig._stepLocking || !trickleConfig._stepLocking._isEnabled == true) return;      
            
            if (model.get(completionAttribute) && !trickleConfig._isLocking) trickleConfig._isInteractionComplete = true;

            if (!trickleConfig._isInteractionComplete) {
                
                trickleConfig._isLocking = true;

            }

            if (trickleConfig._stepLocking._isLockedOnRevisit || 
                (trickleConfig._stepLocking._isCompletionRequired && !model.get(completionAttribute))) {

                trickleConfig._isInteractionComplete = false;
                trickleConfig._isLocking = true;

            }

        },

        getModelTrickleConfig: function(model) {

            function initializeModelTrickleConfig(model, parent) {
                var trickleConfig = model.get("_trickle");

                var courseConfig = Adapt.course.get("_trickle");
                if (courseConfig && courseConfig._isEnabled === false) return false;

                var trickleConfig = $.extend(true, 
                    {}, 
                    DefaultTrickleConfig, 
                    trickleConfig,
                    { 
                        _id: model.get("_id"), 
                        _areDefaultsSet: true,
                        _index: parent.getModelPageIndex(model)
                    }
                );

                if (model.get("_type") != "article") {
                    trickleConfig._onChildren = false;
                }

                var isLastPageItem = ( trickleConfig._index == parent._descendantsChildrenFirst.length - 2 );
                if (isLastPageItem && model.get("_type") != "article") {
                    return false;
                }

                model.set("_trickle", trickleConfig);

                return true;
            }

            var trickleConfig = model.get("_trickle");
            if (trickleConfig === undefined) return false;

            //if has been initialized already, return;
            if (trickleConfig._areDefaultsSet) return trickleConfig;

            if (!initializeModelTrickleConfig(model, this)) return false;
            
            return model.get("_trickle");
        },

        getModelPageIndex: function(model) {
            var descendants = this._descendantsChildrenFirst.toJSON();
            var pageDescendantIds = _.pluck(descendants, "_id");

            var id = model.get("_id");
            var index = _.indexOf( pageDescendantIds, id );

            return index;
        },

        initializeStepUnlockWait: function() {
            this._waitForUnlockRequestsCount = 0;
        },

        checkApplyTrickleToChildren: function(model) {
            if (model.get("_type") != "article") return;

            var trickleConfig = this.getModelTrickleConfig(model);
            if (!trickleConfig) return;
            if (!trickleConfig._onChildren) return;

            this.applyTrickleToChildren(model, trickleConfig);
        },

        applyTrickleToChildren: function(model, parentTrickleConfig) {
            var children = model.getChildren().models;
            for (var i = 0, l = children.length; i < l; i++) {

                var child = children[i];
                var childTrickleConfig = child.get("_trickle");

                var isLastItem = (i == l - 1);

                var isEnabled = true;
                if (childTrickleConfig) {
                    if (childTrickleConfig._isEnabled === false) {
                        isEnabled = false;
                    }
                }
                if (parentTrickleConfig) {
                    if (parentTrickleConfig._isEnabled === false) {
                        isEnabled = false;
                    }
                }

                var trickleConfig = $.extend(true, 
                    {}, 
                    parentTrickleConfig, 
                    childTrickleConfig, 
                    { 
                        _id: child.get("_id"),
                        _onChildren: false,
                        _isEnabled: isEnabled,
                        _isLastItem: isLastItem,
                        _index: this.getModelPageIndex(child)
                    }
                );

                var isLastPageItem = ( trickleConfig._index == this._descendantsChildrenFirst.length - 2 );
                if (isLastPageItem) {
                    continue;
                }

                child.set("_trickle", trickleConfig);

                this.checkResetModel(child);
                
            }
        },

        resizeBodyToCurrentIndex: function() {
            if (!this._isTrickleOn) return;
            
            if (this._isFinished) return this.showElements();

            this._listenToResizeEvent = false;

            this.showElements();

            var id = this.getCurrentStepModel().get("_id");
            var $element = $("." + id);

            if ($element.length === 0) {
                return;
            }

            var elementOffset = $element.offset();
            var elementBottomOffset = elementOffset.top + $element.outerHeight();

            $('body').css("height", elementBottomOffset + "px");
        },

        showElements: function() {
            if (!this._descendantsParentFirst) return;

            var model = this.getCurrentStepModel();
            var ancestors = this._descendantsParentFirst.models;
            var ancestorIds = _.pluck(this._descendantsParentFirst.toJSON(), "_id");

            var showToId;
            if (model !== undefined) {
                //Not at end of trickle
                showToId = model.get("_id");

                var isLastType = Models.isLastStructureType(model);

                if (!isLastType) {
                    //If current step model is not a component type:
                    //then show components for the selected parent
                    var currentAncestorIndex = _.indexOf(ancestorIds, showToId);
                    var ancestorChildComponents = ancestors[currentAncestorIndex].findDescendants("components");

                    showToId = ancestorChildComponents.models[ancestorChildComponents.models.length-1].get("_id");
                }

            } else {
                //At end, show all ids
                showToId = ancestors[ancestors.length -1].get("_id");
            }
            
            
            var showToIndex = _.indexOf(ancestorIds, showToId);

            for (var i = 0, l = ancestors.length; i < l; i++) {
                var itemModel = ancestors[i];
                if (i <= showToIndex) {
                    itemModel.set("_isVisible", true, { pluginName: "trickle" });
                } else {
                    itemModel.set("_isVisible", false, { pluginName: "trickle" });
                }
            }
            
        },

        getCurrentStepModel: function() {
            if (!this._descendantsChildrenFirst) return;

            return this._descendantsChildrenFirst.models[this._currentStepIndex];
        },

        setupStep: function(model) {
            var trickleConfig = this.getModelTrickleConfig(model)
            if (!trickleConfig) return;
            if (!trickleConfig._isEnabled) return;
            if (trickleConfig._onChildren) return;

            var isStepLocking = this.isModelStepLocking(model);
            trickleConfig._isStepLocking = isStepLocking;

            Adapt.trigger("trickle:interactionInitialize", model);
        },

        initializeStep: function() {
            if (this._isFinished) return;
            this.initializeStepUnlockWait();

            if (this.hasCurrentStepLock()) {
                this.startTrickle();
            } else {
                this.endTrickle();
            }
        },

        hasCurrentStepLock: function() {
            var currentIndex = this._currentStepIndex;
            var descendants = this._descendantsChildrenFirst.models;
            for (var i = currentIndex, l = descendants.length; i < l; i++) {
                var descendant = descendants[i];

                if (!this.isModelStepLocking(descendant)) continue;

                this._currentStepIndex = i;
                

                return true;
            }

            return false;
        },

        isModelStepLocking: function(model) {
            var trickleConfig = this.getModelTrickleConfig(model)
            if (!trickleConfig) return false;
            if (trickleConfig._onChildren) return false;

            if (trickleConfig._isEnabled === false) return false;
            
            if (!trickleConfig._stepLocking || !trickleConfig._stepLocking._isEnabled) return false;
            
            if (trickleConfig._isLocking) return true;
            if (trickleConfig._isInteractionComplete) return false;

            var isComplete = model.get(completionAttribute);
            if (isComplete !== undefined) return !isComplete;

            return true;
        },

        startTrickle: function() {
            this._isTrickleOn = true;
            $("html").addClass("trickle");
            Adapt.trigger("steplocking:waitInitialize");
            this.resizeBodyToCurrentIndex();
            this._listenToResizeEvent = true;
        },

        endTrickle: function() {
            this._currentStepIndex = -1;
            this._isFinished = true;
            $("body").css("height", "");
            $("html").removeClass("trickle");
            this._pageView = null;
            this.resizeBodyToCurrentIndex();
            this._isPageReady = false;
            this._listenToResizeEvent = true;
            this._isTrickleOn = false;
        },

        //completion reorder and processing
        _completionQueue: [],
        queueOrExecuteCompletion: function(model, value, isPerformCompletionQueue) {
            if (value === false) return;    

            if (isPerformCompletionQueue !== true) {
                //article, block and component completion trigger in a,b,c order need in c,b,a order
                //otherwise block completion events will occur before component completion events
                
                var isLastType = Models.isLastStructureType(model);

                if (!isLastType) {
                    //defer completion event handling if not at component level
                    return this._completionQueue.push({
                        model: model,
                        value: value    
                    });
                } else {
                    //if at component level, handle completion queue events after component completion is handled
                    if (this._isPageReady) {
                        _.defer(_.bind(this.performCompletionQueue, this));
                    } else {
                        this.listenToOnce(Adapt, "trickle:pageReady", function(){                            
                            this.performCompletionQueue();
                        });
                    }
                }
            }

            if (this._isPageReady) {
                Adapt.trigger("steplocking:waitCheck", model);
                this.checkStepComplete(model);
            } else {                
                this.listenToOnce(Adapt, "trickle:pageReady", function(){                    
                    Adapt.trigger("steplocking:waitCheck", model);
                    this.checkStepComplete(model);
                });
            }
        },

        performCompletionQueue: function() {
            while (this._completionQueue.length > 0) {
                var item = this._completionQueue.pop();
                this.queueOrExecuteCompletion(item.model, item.value, true);
            }
        },

        checkStepComplete: function(model) {
            if (this._isFinished) return;

            var currentModel = this.getCurrentStepModel();

            //if the model does not match the current trickle item then break
            if (model.get("_id") != currentModel.get("_id")) return;

            var trickleConfig = this.getModelTrickleConfig(model);
            if (!trickleConfig) return;
            
            //if plugins need to present before the interaction then break
            if (this.isStepUnlockWaiting()) return;
            
            //if completion is required and item is not yet complete then break
            if (trickleConfig._stepLocking._isCompletionRequired && !model.get(completionAttribute)) return;

            Adapt.trigger("trickle:interactionRequired", model);
            
            //if plugins need to present before the next step occurs then break
            if (this.isStepUnlockWaiting()) return;

            //set interaction complete
            trickleConfig._isLocking = false;
            trickleConfig._isInteractionComplete = true;

            this.stepComplete(model);
        },

        stepComplete: function(model) {
            this.initializeStep();

            Adapt.trigger('device:resize');

            this.scrollToStep(model);
        },

        scrollToStep: function(model) {
            var trickleConfig = this.getModelTrickleConfig(model);
            if (trickleConfig._autoScroll === false) return;

            var scrollTo = trickleConfig._scrollTo;
            
            //Allows trickle to scroll to a sibling / cousin component relative to the current trickle item
            this.relativeScrollTo( model, scrollTo );
        },

        isStepUnlockWaiting: function() {
            return this._waitForUnlockRequestsCount > 0;
        },
        
        relativeScrollTo: function(model, scrollTo) {
            if (scrollTo === undefined) scrollTo = "@block +1";

            var scrollToId = "";
            switch (scrollTo.substr(0,1)) {
            case "@":
                //NAVIGATE BY RELATIVE TYPE
                
                //Allows trickle to scroll to a sibling / cousin component relative to the current trickle item
                var relativeModel = Models.findRelative(model, scrollTo);
                
                if (relativeModel === undefined) return;
                scrollToId = relativeModel.get("_id");

                break;
            case ".":
                //NAVIGATE BY CLASS
                scrollToId = scrollTo.substr(1, scrollTo.length-1);
                break;
            default: 
                scrollToId = scrollTo;
            }

            if (scrollToId == "") return;
            
            var duration = model.get("_trickle")._scrollDuration || 500;
            _.delay(function() {
                Adapt.scrollTo("." + scrollToId, { duration: duration });
            }, 250);
        }
        
    }, Backbone.Events);

    Trickle.initialize();

    return Trickle;

})
;
define('extensions/adapt-contrib-tutor/js/adapt-contrib-tutor',[
    'coreJS/adapt'
],function(Adapt) {

    Adapt.on('questionView:showFeedback', function(view) {

        var alertObject = {
            title: view.model.get("feedbackTitle"),
            body: view.model.get("feedbackMessage")
        };

        if (view.model.has('_isCorrect')) {
            // Attach specific classes so that feedback can be styled.
            if (view.model.get('_isCorrect')) {
                alertObject._classes = 'correct';
            } else {
                if (view.model.has('_isAtLeastOneCorrectSelection')) {
                    // Partially correct feedback is an option.
                    alertObject._classes = view.model.get('_isAtLeastOneCorrectSelection')
                        ? 'partially-correct'
                        : 'incorrect';
                } else {
                    alertObject._classes = 'incorrect';
                }
            }
        }

        Adapt.once("notify:closed", function() {
            Adapt.trigger("tutor:closed");
        });

        Adapt.trigger('notify:popup', alertObject);

        Adapt.trigger('tutor:opened');
    });

});

define('components/adapt-contrib-accordion/js/adapt-contrib-accordion',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Accordion = ComponentView.extend({

        events: {
            'click .accordion-item-title': 'toggleItem'
        },

        preRender: function() {
            // Checks to see if the accordion should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setReadyStatus();
        },

        // Used to check if the accordion should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }

            _.each(this.model.get('_items'), function(item) {
                item._isVisited = false;
            });
        },

        toggleItem: function(event) {
            event.preventDefault();
            this.$('.accordion-item-body').stop(true, true).slideUp(200);

            if (!$(event.currentTarget).hasClass('selected')) {
                this.$('.accordion-item-title').removeClass('selected');
                var body = $(event.currentTarget).addClass('selected visited').siblings('.accordion-item-body').slideToggle(200, function() {
                  $(body).a11y_focus();
                });
                this.$('.accordion-item-title-icon').removeClass('icon-minus').addClass('icon-plus');
                $('.accordion-item-title-icon', event.currentTarget).removeClass('icon-plus').addClass('icon-minus');

                if ($(event.currentTarget).hasClass('accordion-item')) {
                    this.setVisited($(event.currentTarget).index());
                } else {
                    this.setVisited($(event.currentTarget).parent('.accordion-item').index());
                }
            } else {
                this.$('.accordion-item-title').removeClass('selected');
                $(event.currentTarget).removeClass('selected');
                $('.accordion-item-title-icon', event.currentTarget).removeClass('icon-minus').addClass('icon-plus');
            }
            // set aria-expanded value
            if ($(event.currentTarget).hasClass('selected')) {
                $('.accordion-item-title').attr('aria-expanded', false);
                $(event.currentTarget).attr('aria-expanded', true);
            } else {
                $(event.currentTarget).attr('aria-expanded', false);
            }
        },

        setVisited: function(index) {
            var item = this.model.get('_items')[index];
            item._isVisited = true;
            this.checkCompletionStatus();
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item._isVisited;
            });
        },

        checkCompletionStatus: function() {
            if (this.getVisitedItems().length == this.model.get('_items').length) {
                this.setCompletionStatus();
            }
        }

    });

    Adapt.register('accordion', Accordion);

    return Accordion;

});

define('components/adapt-contrib-text/js/adapt-contrib-text',['require','coreViews/componentView','coreJS/adapt'],function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var Text = ComponentView.extend({

        preRender: function() {
            // Checks to see if the text should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setReadyStatus();

            // Check if instruction or title or body is set, otherwise force completion
            var cssSelector = this.$('.component-instruction').length > 0
                ? '.component-instruction'
                : (this.$('.component-title').length > 0 
                ? '.component-title' 
                : (this.$('.component-body').length > 0 
                ? '.component-body' 
                : null));

            if (!cssSelector) {
                this.setCompletionStatus();
            } else {
                this.model.set('cssSelector', cssSelector);
                this.$(cssSelector).on('inview', _.bind(this.inview, this));
            }
        },

        // Used to check if the text should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$(this.model.get('cssSelector')).off('inview');
                    this.setCompletionStatus();
                }
            }
        }

    });

    Adapt.register('text', Text);

    return Text;

});

define('menu/adapt-contrib-boxmenu/js/adapt-contrib-boxmenu',[
    'coreJS/adapt',
    'coreViews/menuView'
], function(Adapt, MenuView) {

    var BoxMenuView = MenuView.extend({

        postRender: function() {
            var nthChild = 0;
            this.model.getChildren().each(function(item) {
                if (item.get('_isAvailable')) {
                    nthChild++;
                    item.set("_nthChild", nthChild);
                    this.$('.menu-container-inner').append(new BoxMenuItemView({model: item}).$el);
                }
            });
        }

    }, {
        template: 'boxmenu'
    });

    var BoxMenuItemView = MenuView.extend({

        events: {
            'click button' : 'onClickMenuItemButton'
        },

        className: function() {
            var nthChild = this.model.get("_nthChild");
            return [
                'menu-item',
                'menu-item-' + this.model.get('_id') ,
                this.model.get('_classes'),
                'nth-child-' + nthChild,
                nthChild % 2 === 0 ? 'nth-child-even' : 'nth-child-odd'
            ].join(' ');
        },

        preRender: function() {
            this.model.checkCompletionStatus();
            this.model.checkInteractionCompletionStatus();
        },

        postRender: function() {
            var graphic = this.model.get('_graphic');
            if (graphic && graphic.src && graphic.src.length > 0) {
                this.$el.imageready(_.bind(function() {
                    this.setReadyStatus();
                }, this));
            } else {
                this.setReadyStatus();
            }
        },

        onClickMenuItemButton: function(event) {
            if(event && event.preventDefault) event.preventDefault();
            Backbone.history.navigate('#/id/' + this.model.get('_id'), {trigger: true});
        }

    }, {
        template: 'boxmenu-item'
    });

    Adapt.on('router:menu', function(model) {

        $('#wrapper').append(new BoxMenuView({model: model}).$el);

    });

});

define('theme/adapt-contrib-vanilla/js/theme-block',['require','coreJS/adapt','backbone'],function(require) {
	
	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');

	var ThemeBlockView = Backbone.View.extend({

		initialize: function() {
			this.setStyles();
			this.listenTo(Adapt, 'device:resize', this.setStyles);
			this.listenTo(Adapt, 'remove', this.remove);
		},

		setStyles: function() {
			this.setBackground();
			this.setMinHeight();
			this.setDividerBlock();
		},

		setBackground: function() {
			var backgroundColor = this.model.get('_themeBlockConfig')._backgroundColor;
			
			if (backgroundColor) {
				this.$el.addClass(backgroundColor);
			}
		},

		setMinHeight: function() {
			var minHeight = 0;
			var minHeights = this.model.get('_themeBlockConfig')._minimumHeights;

			if (minHeights) {

				if(Adapt.device.screenSize == 'large') {
					minHeight = minHeights._large;
				} else if (Adapt.device.screenSize == 'medium') {
					minHeight = minHeights._medium;
				} else {
					minHeight = minHeights._small;
				}
			}

			this.$el.css({
				minHeight: minHeight + "px"
			});
		},

		setDividerBlock: function() {
			var dividerBlock = this.model.get('_themeBlockConfig')._isDividerBlock;

			if (dividerBlock) {
				this.$el.addClass('divider-block');
			}
		}
	});

	return ThemeBlockView;
	
});

define('theme/adapt-contrib-vanilla/js/vanilla',['require','coreJS/adapt','backbone','theme/adapt-contrib-vanilla/js/theme-block'],function(require) {
	
	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var ThemeBlock = require('theme/adapt-contrib-vanilla/js/theme-block');

	// Block View
	// ==========

	Adapt.on('blockView:postRender', function(view) {
		var theme = view.model.get('_theme');
		
		if (theme) {
			new ThemeBlock({
				model: new Backbone.Model({
					_themeBlockConfig: theme
				}),
				el: view.$el
			});
		}
	});
});

define('bundles',[
	"extensions/adapt-contrib-pageLevelProgress/js/adapt-contrib-pageLevelProgress",
	"extensions/adapt-contrib-resources/js/adapt-contrib-resources",
	"extensions/adapt-contrib-spoor/js/adapt-contrib-spoor",
	"extensions/adapt-contrib-trickle/js/adapt-contrib-trickle",
	"extensions/adapt-contrib-tutor/js/adapt-contrib-tutor",
	"components/adapt-contrib-accordion/js/adapt-contrib-accordion",
	"components/adapt-contrib-text/js/adapt-contrib-text",
	"menu/adapt-contrib-boxmenu/js/adapt-contrib-boxmenu",
	"theme/adapt-contrib-vanilla/js/vanilla"
],function(){});

//# sourceMappingURL=bundles.js.map