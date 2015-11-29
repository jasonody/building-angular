//https://github.com/teropa/build-your-own-angularjs/blob/80bbdea86d5fa5e8233ff9bb866053d17048f6cf/karma.conf.js

module.exports = function(config) {
	config.set({
		frameworks: ['browserify', 'jasmine'],
		files: [
			'src/**/*.js',
			'tests/**/*.spec.js'
		],
		preprocessors: {
			'tests/**/*.js': ['jshint', 'browserify'],
			'src/**/*.js': ['jshint', 'browserify']
		},
		browsers: ['Chrome'],
		browserify: {
			debug: true,
			bundleDelay: 2000 // Fixes "reload" error messages, YMMV!
		}
	})
};