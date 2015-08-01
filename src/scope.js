'use strict';

function initWatchValue() { }

function Scope() {
	
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
}

Scope.prototype.$watch = function (watchFn, listenerFn) {
	
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function () { },
		last: initWatchValue
	};
	
	this.$$watchers.push(watcher);
	this.$$lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function () {
	
	var self = this;
	var newValue, oldValue, dirty;
	
	this.$$watchers.some(function (watcher) {
		
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;

		if (newValue !== oldValue) {
			self.$$lastDirtyWatch = watcher;
			
			watcher.last = newValue;
			watcher.listenerFn(newValue, 
												 (oldValue === initWatchValue ? newValue : oldValue), 
												 self);
			dirty = true;
		} else if (self.$$lastDirtyWatch === watcher) {
			return true; //shortcircuit iteration over watchers
		}
	});
	
	return dirty;
};

Scope.prototype.$digest = function () {
	
	var ttl = 10; //Time To Live
	var dirty;
	
	this.$$lastDirtyWatch = null;
	
	do {
		
		dirty = this.$$digestOnce();
		
		if (dirty && !(ttl--)) {
			throw "10 digest iterations reached";
		}
	} while (dirty);
};