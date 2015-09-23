'use strict';

function initWatchValue() { }

function Scope() {
	
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
	this.$$asyncQueue = [];
	this.$$applyAsyncQueue = [];
	this.$$applyAsyncId = null;
	this.$$postDigestQueue = [];
	this.$root = this;
	this.$$children = [];
	this.$$phase = null;
}

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
	
	var self = this;
	
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function () { },
		valueEq: !!valueEq,
		last: initWatchValue
	};
	
	this.$$watchers.unshift(watcher);
	this.$root.$$lastDirtyWatch = null;
	
	return function () {
		
		var index = self.$$watchers.indexOf(watcher);
		if (index >= 0) {
			self.$$watchers.splice(index, 1);
			self.$root.$$lastDirtyWatch = null; //prevent short-circuiting optimization when removing a $watch, p.61
		}
	};
};

Scope.prototype.$$digestOnce = function () {
	
	var dirty;
	var continueLoop = true;
	var self = this;
	
	this.$$everyScope(function (scope) {
		
		var newValue, oldValue;

		_.forEachRight(scope.$$watchers, function (watcher) {
			if (watcher) {
				try {
					newValue = watcher.watchFn(scope);
					oldValue = watcher.last;

					if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
						self.$root.$$lastDirtyWatch = watcher;

						watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
						watcher.listenerFn(newValue, 
															 (oldValue === initWatchValue ? newValue : oldValue), 
															 scope);
						dirty = true;
					} else if (self.$root.$$lastDirtyWatch === watcher) {
						continueLoop = false;
						return false; //shortcircuit iteration over watchers (exits 'forEachRight' loop)
					}
				} catch (e) {
					console.error(e);
				}	
			}
		});
		
		return continueLoop;
	});
	
	return dirty;
};

Scope.prototype.$digest = function () {
	
	var ttl = 10; //Time To Live
	var dirty;
	
	this.$root.$$lastDirtyWatch = null;
	this.$beginPhase('$digest');
	
	if (this.$$applyAsyncId) {
		clearTimeout(this.$root.$$applyAsyncId); //Cancel pending timeout to flush applyAsync queue
		this.$$flushApplyAsync(); //Flush applyAsync queue immediately
	}
	
	do {
		while (this.$$asyncQueue.length) {
			try {
				var asyncTask = this.$$asyncQueue.shift(); //remove first element from an array
				asyncTask.scope.$eval(asyncTask.expression);
			} catch (e) {
				console.error(e);	
			}
		}
		
		dirty = this.$$digestOnce();
		
		if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
			this.$clearPhase();
			throw "10 digest iterations reached";
		}
	} while (dirty || this.$$asyncQueue.length);
	
	this.$clearPhase();
	
	while (this.$$postDigestQueue.length) {
		try {
			this.$$postDigestQueue.shift()();
		} catch (e) {
			console.error(e);
		}
	}
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
		this.$beginPhase('$apply');
		
		return this.$eval(expr);
	} finally {
		this.$clearPhase();
		this.$root.$digest();
	}
};

Scope.prototype.$evalAsync = function (expr) {
	
	var self = this;
	
	if (!self.$$phase && !self.$$asyncQueue.length) {
		setTimeout(function () {
			
			if (self.$$asyncQueue.length) {
				self.$root.$digest();
			}
		}, 0);	
	}
	
	this.$$asyncQueue.push({ scope: this, expression: expr });
};

Scope.prototype.$beginPhase = function (phase) {
	
	if (this.$$phase) {
		throw this.$$phase + ' already in progress.';
	}
	
	this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
	
	this.$$phase = null;
};

Scope.prototype.$applyAsync = function (expr) {
	
	var self = this;
	
	self.$$applyAsyncQueue.push(function () {
		
		self.$eval(expr);
	});
	
	if (self.$root.$$applyAsyncId === null) {
		self.$root.$$applyAsyncId = setTimeout(function () {

			self.$apply(function () {
				self.$$flushApplyAsync();
			}.bind(self));
		}, 0);
	}
};

Scope.prototype.$$flushApplyAsync = function () {

	while (this.$$applyAsyncQueue.length) {
		try {
			this.$$applyAsyncQueue.shift()();	
		} catch (e) {
			console.error(e);	
		}
	}

	this.$root.$$applyAsyncId = null;
};

Scope.prototype.$$postDigest = function (fn) {
	
	this.$$postDigestQueue.push(fn);
};

Scope.prototype.$watchGroup = function (watchFns, listenerFn) {
	
	var self = this;
	
	var newValues = new Array(watchFns.length);
	var oldValues = new Array(watchFns.length);
	var changeReactionScheduled = false;
	var firstRun = true;
	
	if (watchFns.length === 0) {
		
		var shouldCall = true;
		
		self.$evalAsync(function () {
			
			if (shouldCall) {
				listenerFn(newValues, oldValues, self);	
			}
		});
		
		return function () {
			
			shouldCall = false;
		};
	};
	
	function watchGroupListener () { 
	
		if (firstRun) {
			firstRun = false;
			listenerFn(newValues, newValues, self);
		} else {
			listenerFn(newValues, oldValues, self);	
		}
		
		changeReactionScheduled = false;
	};
	
	var destroyFns = watchFns.map(function (watchFn, i) {
		
		return self.$watch(watchFn, function (newValue, oldValue) {
			
			newValues[i] = newValue;
			oldValues[i] = oldValue;
			
			if (!changeReactionScheduled) {
				changeReactionScheduled = true;
				self.$evalAsync(watchGroupListener);
			}
		});
	});
	
	return function () {
		
		destroyFns.forEach(function (destroyFn) {
			
			destroyFn();
		});
	};
};

Scope.prototype.$new = function (isolated, parent) {
	
	var child;
	parent = parent || this;
	
	if (isolated) {
		child = new Scope();
		child.$root = parent.$root;
		child.$$asyncQueue = parent.$$asyncQueue;
		child.$$postDigestQueue = parent.$$postDigestQueue;
		child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
	} else {
		var ChildScope = function () { };
		ChildScope.prototype = this;
		child = new ChildScope();
	}
	
	parent.$$children.push(child);
	child.$$watchers = [];
	child.$$children = [];
	child.$parent = parent;
	
	return child;
};

Scope.prototype.$$everyScope = function (fn) {
	
	if (fn(this)) {
		return this.$$children.every(function (child) {
			
			return child.$$everyScope(fn);
		});
	} else {
		return false;
	}
};

Scope.prototype.$destroy = function () {
	
	if (this.$parent) {
		var siblings = this.$parent.$$children;
		var indextOfThis = siblings.indexOf(this);
		
		if (indextOfThis >= 0) {
			siblings.splice(indextOfThis, 1);
		}
		this.$$watchers = null;
	}
};

Scope.prototype.$watchCollection = function (watchFn, listenerFn) {
	
	var self = this;
	var newValue, oldValue;
	var changeCount = 0;
	
	var internalWatchFn = function (scope) {
		
		newValue = watchFn(scope);
		
		if (_.isObject(newValue)) {
			if(_.isArrayLike(newValue)) {
				if(!_.isArray(oldValue)) {
					changeCount++;
					oldValue = [];
				}
				
				if (newValue.length !== oldValue.length) {
					changeCount++;
					oldValue.length = newValue.length;
				}
				
				_.forEach(newValue, function(newItem, i) {
					
					var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
					if(!bothNaN && (newItem !== oldValue[i])) {
						changeCount++;
						oldValue[i] = newItem;
					}
				});
			}
		} else { //everything else that isn't an object
			if (!self.$$areEqual(newValue, oldValue, false)) { //3rd arg indicates to use reference comparison
				changeCount++;
			}

			oldValue = newValue;
		}
		
		return changeCount;
	};
	
	var internalListenerFn = function () {
		
		listenerFn(newValue, oldValue, self);
	};
	
	return this.$watch(internalWatchFn, internalListenerFn);
};