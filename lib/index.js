'use strict';

/**
 * Module dependencies.
 */

var convertDates = require('@segment/convert-dates');
var defaults = require('@ndhoule/defaults');
var del = require('obj-case').del;
var integration = require('@segment/analytics.js-integration');
var is = require('is');
var extend = require('@ndhoule/extend');

/**
 * Expose `Intercom` integration.
 */

var Intercom = module.exports = integration('Intercom')
  .global('Intercom')
  .option('activator', '#IntercomDefaultWidget')
  .option('appId', '')
  .tag('<script src="https://widget.intercom.io/widget/{{ appId }}">');

/**
 * Initialize.
 *
 * http://docs.intercom.io/
 * http://docs.intercom.io/#IntercomJS
 *
 * @api public
 */

Intercom.prototype.initialize = function() {
  // Shim out the Intercom library.
  window.Intercom = function() {
    window.Intercom.q.push(arguments);
  };
  window.Intercom.q = [];

  this.load(this.ready);
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

Intercom.prototype.loaded = function() {
  return typeof window.Intercom === 'function';
};

/**
 * Page.
 *
 * @api public
 * @param {Page} page
 */

Intercom.prototype.page = function(page) {
  var integrationSettings = page.options(this.name);
  this.bootOrUpdate({}, integrationSettings);
};

/**
 * Identify.
 *
 * http://docs.intercom.io/#IntercomJS
 *
 * @api public
 * @param {Identify} identify
 */

Intercom.prototype.identify = function(identify) {
  var traits = identify.traits({ userId: 'user_id' });
  var integrationSettings = identify.options(this.name);
  var companyCreated = identify.companyCreated();
  var created = identify.created();
  var name = identify.name();
  var id = identify.userId();
  var group = this.analytics.group();

  if (!id && !identify.email()) {
    return;
  }

  // intercom requires `company` to be an object. default it with group traits
  // so that we guarantee an `id` is there, since they require it
  if (traits.company !== null && !is.object(traits.company)) {
    delete traits.company;
  }

  if (traits.company) {
    defaults(traits.company, group.traits());
  }

  // name
  if (name) traits.name = name;

  // handle dates
  if (created) {
    del(traits, 'created');
    del(traits, 'createdAt');
    traits.created_at = created;
  }

  if (companyCreated) {
    del(traits.company, 'created');
    del(traits.company, 'createdAt');
    traits.company.created_at = companyCreated;
  }

  // convert dates
  traits = convertDates(traits, formatDate);

  // handle options
  if (integrationSettings.userHash) traits.user_hash = integrationSettings.userHash;
  if (integrationSettings.user_hash) traits.user_hash = integrationSettings.user_hash;

  this.bootOrUpdate(traits, integrationSettings);
};

/**
 * Group.
 *
 * @api public
 * @param {Group} group
 */

Intercom.prototype.group = function(group) {
  // using .traits here since group.properties() doesn't take alias object
  var props = group.traits({
    createdAt: 'created',
    created: 'created_at'
  });
  props = convertDates(props, formatDate);
  var id = group.groupId();
  if (id) props.id = id;
  var integrationSettings = group.options(this.name);
  var traits = extend({ company: props }, hideDefaultLauncher(integrationSettings));

  api('update', traits);
};

/**
 * Track.
 *
 * @api public
 * @param {Track} track
 */

 Intercom.prototype.track = function(track) {
     api('trackEvent', track.event(), flattenObject(track.properties()));
 };

 var flattenObject = function(ob) {
 	var toReturn = {};

 	for (var i in ob) {
 		if (!ob.hasOwnProperty(i)) continue;

 		if ((typeof ob[i]) == 'object') {
 			var flatObject = flattenObject(ob[i]);
 			for (var x in flatObject) {
 				if (!flatObject.hasOwnProperty(x)) continue;

 				toReturn[i + '_' + x] = flatObject[x];
 			}
 		} else {
 			toReturn[i] = ob[i];
 		}
 	}
 	return toReturn;
 };

/**
 * Boots or updates, as appropriate.
 *
 * @api private
 * @param {Object} options
 */

Intercom.prototype.bootOrUpdate = function(options, integrationSettings) {
  options = options || {};
  var method = this.booted === true ? 'update' : 'boot';
  var activator = this.options.activator;
  options.app_id = this.options.appId;

  // Intercom, will force the widget to appear if the selector is
  // #IntercomDefaultWidget so no need to check inbox, just need to check that
  // the selector isn't #IntercomDefaultWidget.
  if (activator !== '#IntercomDefaultWidget') {
    options.widget = { activator: activator };
  }
  // Check for selective showing of messenger option
  options = extend(options, hideDefaultLauncher(integrationSettings));

  api(method, options);
  this.booted = true;
};

/**
 * Format a date to Intercom's liking.
 *
 * @api private
 * @param {Date} date
 * @return {number}
 */

function formatDate(date) {
  return Math.floor(date / 1000);
}

/**
 * Push a call onto the Intercom queue.
 *
 * @api private
 */

function api() {
  window.Intercom.apply(window.Intercom, arguments);
}

/**
 * Selectively hide messenger
 * https://docs.intercom.io/configure-intercom-for-your-product-or-site/customize-the-intercom-messenger/customize-the-intercom-messenger-technical#show-the-intercom-messenger-to-selected-users-for-web-
 * @param {Object} options
 * @return {Object} ret
 * @api private
 */

function hideDefaultLauncher(options) {
  var ret = {};
  var setting = options.hideDefaultLauncher;
  if (setting === undefined || typeof setting !== 'boolean') return ret;
  ret.hide_default_launcher= setting;
  return ret;
}
