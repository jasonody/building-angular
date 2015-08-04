'use strict';

function initWatchValue() { }

function Scope() {
	
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
	this.$$asyncQueue = [];
}

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
	
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function () { },
		valueEq: !!valueEq,
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

		if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
			self.$$lastDirtyWatch = watcher;
			
			watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
			watcher.listenerFn(newValue, 
												 (oldValue === initWatchValue ? newValue : oldValue), 
												 self);
			dirty = true;
		} else if (self.$$lastDirtyWatch === watcher) {
			return true; //shortcircuit iteration over watchers (exits 'some' loop)
		}
	});
	
	return dirty;
};

Scope.prototype.$digest = function () {
	
	var ttl = 10; //Time To Live
	var dirty;
	
	this.$$lastDirtyWatch = null;
	
	do {
		while (this.$$asyncQueue.length) {
			var asyncTask = this.$$asyncQueue.shift(); //remove first element from an array
			asyncTask.scope.$eval(asyncTask.expression);
		}
		
		dirty = this.$$digestOnce();
		
		if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
			throw "10 digest iterations reached";
		}
	} while (dirty || this.$$asyncQueue.length);
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
	
	if (valueEq) {
		return _.isEqual(newValue, oldValue);
	} else {
		return newValue === oldValue ||
			(typeof newValue === 'number' && typeof oldValue === 'number' &&
			 isNaN(newValue) && isNaN(oldValue));
	}
};

Scope.prototype.$eval = function (expr, locals) {
	
	return expr(this, locals);
};

Scope.prototype.$apply = function (expr) {
	
	try {
		return this.$eval(expr);
	} finally {
		this.$digest();
	}
};

Scope.prototype.$evalAsync = function (expr) {
	
	this.$$asyncQueue.push({ scope: this, expression: expr });
};