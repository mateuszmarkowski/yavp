//Yet Another Validation Plugin
//Mateusz Markowski

(function($) {
	
	$.fn.yavp = function Yavp () {
		var args     = arguments,
			settings = {
				success       : Yavp.success        || null,
				error         : Yavp.error          || null,
				elementSuccess: Yavp.elementSuccess || null,
				elementError  : Yavp.elementError   || null,
				before        : Yavp.before         || null,
				after         : Yavp.after          || null,
				elementBefore : Yavp.elementBefore  || null,
				elementAfter  : Yavp.elementAfter   || null,
				triggers      : Yavp.trigers        || ['change', 'keydown'],
				debounce      : Yavp.debounce       || 350,
				validators    : Yavp.validators     || {},
				messages      : Yavp.messages       || {},
				collections   : Yavp.collections    || {},
				fields        : {}
			},
			$formCache,
			$form,
			$element,
			has_errors,
			_continue, //needs underscore, because continue is a reserved keyword
			anonymousValidatorIndex, //used to generate unique names for anonymous validators
			selectorEvents = []; //WE NEED TO CHANGE ITS NAME, IT'S CONFUSING
			
		//if yavp has already been assigned to this element
		if (this.data('yavp') && typeof args[0] === 'string') {
			//user can pass string to call a function
			this.data('yavp')[args[0]]();
			return this;
		} else if (this.data('yavp')) {
			//or pass nothing to get the public interface
			return this.data('yavp');
		}
		
		//jquery selector that triggers yavp may return more than one element
		this.each(function () {
			//we need an empty jQuery collection
			//form currently being processed 
			$form                     = $(this);
			has_errors                = false;
			_continue                 = false;
			anonymousValidatorIndex = 100;
			
			if (typeof args[0] == 'function') {
				settings = $.extend(true, {}, settings, {
					success : args[0]
				});
			} else {
				//we don't want to overwrite Yavp static variables, so we create a new object
				settings = $.extend(true, {}, settings, args[0]);
			}
			
			$form.attr('novalidate', true); //prevent default browser validation
	
			function processElements() {
				//if selectorEvents is not empty we need to clear all elements data, because user has used refresh
				var tmpArray,
					forceOverwrite = selectorEvents.length > 0 ? true : false;
				
				//we have to collect all selectors so we can bind events to them using bindEvents()
				selectorEvents = [];
				$formCache     = $();
				
				$.each(settings.fields, function (index, field) {
					var elementSettings = {},
						$elements        = {};
					
					//let's check passed field type
					if (typeof field === 'string') {
						//field should be like this: user-form.email
						tmpArray = field.split('.');
						
						if (tmpArray.length !== 2) {
							//we don't know the collection, so we skip this field
							return;
						}
						
						//element settings such as validators, selector has already been defined in some collection
						elementSettings = settings.collections[tmpArray[0]][tmpArray[1]];
						
						//if it's an array, user passed only an array of validators and field name should be used as selector
						if (Array.isArray(elementSettings)) {
							elementSettings = {
								selector  : '[name="'+tmpArray[1]+'"]',
								validators: elementSettings
							};
						}
						
					} else if (typeof field === 'object') {
						//user passed element settings instead of collection/field name
						elementSettings = field;
					}
					
					//user may want to use only the selector he specified without any yavp addons such as :visible:enabled
					if (elementSettings.selectorOverwrite !== true) {
						elementSettings.selector += ':visible:enabled';
					}
					
					//we have to find elements matched by this element's selector
					$elements = $form.find(elementSettings.selector);
					
					if ($elements.length === 0) {
						//nothing found
						return;
					}

					if (forceOverwrite || typeof $elements.data('yavp.validators') === 'undefined') {
						$elements.data('yavp.validators', []);
					}
					
					if (forceOverwrite || typeof $elements.data('yavp.params') === 'undefined') {
						$elements.data('yavp.params', {});
					}
					
					if (typeof elementSettings.chain !== 'undefined') {
						//yavp.chain contains a selector for elements that should be validated right after this element has been validated
						$elements.data('yavp.chain', elementSettings.chain);
					}

					$.each(elementSettings.validators, function (index, validator) {

						if (Object.prototype.toString.call(validator) === '[object RegExp]') {
							//user passed regexp
							$elements.data('yavp.validators').push({
								name     : 'regexp',
								callback : settings.validators.regexp
							});
							
							$elements.data('yavp.params').regexp = {
								regexp : validator	
							};
						} else if (typeof validator === 'string') {
							
						
							if (callback = resolveValidator(validator)) {
								$elements.data('yavp.validators').push({
									name     : validator,
									callback : callback
								});
							}

						} else if (typeof validator === 'object') {
							
							//user passed an object that contains a validator's name and some params maybe
							if (callback = resolveValidator(validator.validator)) {
								$elements.data('yavp.validators').push({
									name     : validator.validator,
									callback : callback
								});
							
								$elements.data('yavp.params')[validator.validator] = (function () {
									var params = {};
									//we need to copy params to element's data
									$.each(validator, function (param, value) {
										if (param !== 'validator') {
											params[param] = value;
										}
									});
									return params;
								})();
							}
							
						} else if (typeof validator === 'function') {
							$elements.data('yavp.validators').push({
								name     : 'anonymous-validator-' + (++anonymousValidatorIndex),
								callback : validator
							});
						}

					});
					
					//make sure it won't get overwritten when field is matched by more than one selector
					$elements.data('yavp.messages', elementSettings.messages || {});
					
					if (settings.cache !== false || typeof elementSettings.cache === 'undefined' ||
						(typeof elementSettings.cache !== 'undefined' && elementSettings.cache !== false)) {
						
						//user could have used a general selector like a class name that will match elements with different tags
						$elements.each(function () {
							$element = $(this);
							//let's create cache objects
	
							//there're some fields that we don't wanna cache for sure, such as checkboxes or radios
							if (($element.prop('tagName').toLowerCase() === 'input' &&
									$.inArray($element.attr('type').toLowerCase(), ['checkbox', 'radio']) === -1) ||
									
										$element.prop('tagName').toLowerCase() === 'textarea') {
								
								$elements.data('yavp.cache-success', []);
								$elements.data('yavp.cache-error', {});	
							}
						});
					}

					$formCache = $formCache.add($elements);
					selectorEvents.push(elementSettings.selector);
				});
				
				//a shorthand to find validator in settings.validators
				function resolveValidator(validator) {
					return validator in settings.validators ? settings.validators[validator] : false;
				}
			}
	
			//binds events to all elements but form
			function bindEvents() {
				var namespacedEvents = (function (triggers) {
					//all our events should be namespaced
					$.each(triggers, function (index, value) {
						triggers[index] = value+'.yavp';
					});
					return triggers.join(' ');
				})(settings.triggers)
			
				//let's unbind all first
				$form.off(namespacedEvents);
								
				//and bind again
				$form.on(
					namespacedEvents,
					selectorEvents.join(','),
					settings.debounce ? debounce(validate, settings.debounce) : validate
				);
			}
			
			function debounce(callback, time) {
				var timeout,
					lastCalled = 0;
				
				return function () {
					var element = this,
						now     = (new Date).getTime(),
						args    = arguments;
									
					if (timeout && now - time < lastCalled) {
						clearTimeout(timeout);
						timeout = null;	
					}
	
					if (!timeout) {
						timeout = setTimeout(function () {
							callback.apply(element, Array.prototype.slice.call(args));
							timeout = null;
						}, time);
					}
					
					lastCalled = now;
				};
			}			
	
			function validate() {
				var promises       = [],
					mainDeferred  = $.Deferred(),
					$formOrField = $(this),
					$elements;
				
				has_errors = false; //reset it
								
				//run before callback if specified
				if (typeof settings.before == 'function') {
					settings.before.call($form);
				}	
				
				if (typeof settings.after == 'function') {
					main.deferred.always(function () {				
						settings.after.call($form);
					});
				}

				function validates(element) {
				
					var asyncResultInstance,
						has_element_errors = false,
						$element           = $(element),
						validators         = $element.data('yavp.validators') ? $element.data('yavp.validators').slice() : [], //we need a copy
						//some validators may drop cache for all other validators, a good example is equals
						dontCache         = false,
						elementDeferred   = $.Deferred(); //element deferred
					
					if ($element.data('yavp.async-result-instance') && $element.data('yavp.async-result-instance').status === 'active') {
						//element is still being validated, i.e. AJAX request is in process, we need to make sure that the result will be ignored
						$element.data('yavp.async-result-instance').revoke();
					}
					
					if (settings.elementBefore) {
						settings.elementBefore.call($element);
					}
								
					function apply_success() {
						var $this = $(this);
												
						//cache the current value, so we won't validate it again
						if (dontCache === false && typeof $this.data('yavp.cache-success') === 'object') {
							//also make sure it's not already cached
							if ($.inArray($this.val(), $this.data('yavp.cache-success')) === -1) {
								$this.data('yavp.cache-success').push($this.val());
							}
						}
							
						if (settings.elementSuccess) {
							settings.elementSuccess.call($this);
						}

					}
					
					function apply_error(validator_name, message) {
						//let's determine if we have a message of if we have to find one
						var type,
							$this = this;
						
						has_errors = has_element_errors  = true;
						
						if (validator_name && message) {
							//we have both explicitely specified
							type    = validator_name;
							message = message;
						} else if (this.data('yavp.messages') && validator_name in $this.data('yavp.messages')) {
							//we just know validator_name and we first check in its element's messages
							type     = validator_name;
							message  = $this.data('yavp.messages')[validator_name];
						} else if (validator_name in settings.messages) {
							//now let's check it if there's a message for it in global settings
							type    = validator_name;
							message = settings.messages[validator_name]; 
						} else if (/^anonymous-validator-[0-9]+$/.test(validator_name)) {
							//let's check if it's a anonymous validator
							type    = 'format';
							message = $this.data('yavp.messages')[type] || settings.messages[type];
						} else if (validator_name in settings.validators) {
							type    = 'format';
							message = settings.messages[type];
						} else {
							//fallback
							type    = 'format';
							message = settings.messages[type];
						}
		
						if (typeof message == 'function') {
							message = message.call($this, $this.data('yavp.params')[type] || {});
						}
		
						if (dontCache === false && typeof $this.data('yavp.cache-error') === 'object') {
							//we need to cache error type along with the message
							$this.data('yavp.cache-error')[$this.val()] =  {
								type    : type,
								message : message
							};
						}
						
						if (settings.elementError) {
							settings.elementError.call($this, message, type);
						}

					}
					
					function AsyncResult(context, deferred, validator_name) {
					
						//A simple interface for handling validation status 		
						return {
							status    : 'active',
							//called when user triggers validation before the previous one was completed
							revoke    : function () {
								this.status = 'inactive';
								elementDeferred.reject();
								return this;
							},
						
							//it will notify the main controller that because of used validator (like equals), we can't cache result
							dontCache: function () {
								//dontCache is also a variable included in the closure
								dontCache = true;
							},
							//if we pass true as stop, we won't process further validatiors and  weill fire apply_success immedietaly 
							success : function (stop) {
								var stop = typeof stop === 'undefined' ? false : stop;
							
								if (this.status === 'inactive') {
									return this;
								}
								
								this.status = 'inactive';

								if (stop) {
									elementDeferred.resolve();
								} else {
									deferred.resolve();
								}
								
								return this;
							},
							
							error   : function (message) {
								if (this.status === 'inactive') {
									return this;
								}
								
								this.status = 'inactive';
								apply_error.call(context, validator_name, message);
								deferred.reject();
								return this;
							}
						}
					}
					
					//we can call success function only after all validators passed
					elementDeferred.done(function () {
						!has_element_errors &&
							apply_success.call($element);
					}).fail(function () {
						console.log('element deferred fail');
					}).always(function () {
						if (settings.elementAfter) {
							settings.elementAfter.call($element);
						}
					});	
					
					//let's check with the error cache first
					if (typeof $element.data('yavp.cache-error') == 'object' &&
						$element.val() in $element.data('yavp.cache-error')) {
						
						var error = $element.data('yavp.cache-error')[$element.val()];
						
						//create new AsyncResult and immeditately resolve error
						(new AsyncResult($element, elementDeferred, error.type)).error(error.message);
						return elementDeferred.promise();
							
					}					
					
					//let's check with the success cache next
					if (typeof $element.data('yavp.cache-success') == 'object' &&
						$.inArray($element.val(), $element.data('yavp.cache-success')) > -1) {

						(new AsyncResult($element, elementDeferred)).success();
						return elementDeferred.promise();
							
					}		

					//we start checking next validator only if previous has been successful
					(function run_validator(validators) {
						if (!validators.length) {
							elementDeferred.resolve();
							return;
						}
					
						var validator,
							result,
							validator_deferred = $.Deferred();
						
						validator_deferred.done(function () {
							run_validator(validators);
						}).fail(function () {
							elementDeferred.resolve();
						});
						
						//get first remaining validator and run it
						validator    = validators.shift();
						
						//create asyncResultInstance
						asyncResultInstance = AsyncResult($element, validator_deferred, validator.name);
						
						//we need to store it, so to be able to revoke if user triggers validation again
						$element.data('yavp.async-result-instance', asyncResultInstance);
						
						//call validator in $element's context and pass its params
						result       = validator.callback.call(
							$element,
							asyncResultInstance,
							$element.data('yavp.params')[validator.name] || {}
							//validator.name in $element.data('yavp.params') ? $element.data('yavp.params')[validator.name] : {}
						);

						//if user returns boolean, we can immedietaly handle result
						if (typeof result === 'boolean') {
							result === true ? asyncResultInstance.success() : asyncResultInstance.error();
						}
							
					})(validators);
				
					//only expose public interface
					return elementDeferred.promise();
				}
								
				if ($formOrField.prop('tagName').toLowerCase() === 'form') {
					//we are validating all fields like on submit
					$elements = $formCache;
				} else {
					//we are validating a single element
					$elements = $formOrField;
					
					//let's check if there're any other elements chained. If so, let's validate them as well
					if (typeof $formOrField.data('yavp.chain') !== 'undefined') {
						$elements = $elements.add($form.find($formOrField.data('yavp.chain')));
					}
				}

				$elements.each(function(index, element) {
					//each element returns a promise, once it's resolved we know the validation result
					promises.push(validates(element));
				});
				
				//if there're promises, we have to wait until all have been resolved
				if (promises.length) {
					//we have to pass an array of promises, so we use apply function
					$.when.apply(null, promises).done(function () {
						mainDeferred.resolve();
					});
				} else {
					mainDeferred.resolve();
				}
	
				return mainDeferred.promise();
			}
					
			$form.submit(function (e) {
				var form           = this,
					//we have to prevent the default's event, because we are async. That's why we give user a simulated event
					simulatedEvent = $.Event('submit', {
						target : form
					});
				
				e.preventDefault();
				
				//validate.call(form) will return a promise
				$.when(validate.call(form)).done(function (errors) {

					if (has_errors) {
						//form has validation errors, we have to check if there's an error callback specified
						if (typeof settings.error == 'function') {
							settings.error.call(form, simulatedEvent);
						}
					} else {
						//if user explicitly returns false, form won't be submitted
						_continue  = typeof settings.success == 'function' ?
							settings.success.call(form, simulatedEvent) !== false : true;
							
						if (_continue && !simulatedEvent.isDefaultPrevented()) {
							form.submit(); //skip jQuery interface
						}
					}

				});
				
			});
					
			processElements();
			bindEvents();
					
			//public methods
			$form.data('yavp', {
				//use that method when you're adding/removing fields from the form to flush yavp cache
				refresh : function () {
					processElements();
					bindEvents();
				}
				
			});
		});
		
		return this;
	};

	$.fn.yavp.validators = {
		'optional'    : function (result) {
			if (this.val().length === 0) {
				//we pass true, so no further validators will be processed for this element
				result.success(true);
			} else {
				//element also passes validation, but since it's not empty we need to process further validators
				return true;
			}
		},
		'required'    : function () {
			return this.val().length === 0 ? false : true;	
		},
		'number'      : function () {
			return /^[0-9]+$/.test(this.val());
		},
		'decimal'      : function () {
			return /^[0-9]+(\.[0-9]+)?$/.test(this.val());
		},
		'name'      : function () {
			return /^[a-z ']+$/i.test(this.val());
		},
		'email'      : function () {
			return /^[-0-9a-z.+_]+@[-0-9a-z.+_]+\.[a-z]{2,4}$/i.test(this.val());
		},
		'length'     : function (result, params) {
			var	l     = this.val().length,
				min   = parseInt(params.min),
				max   = parseInt(params.max);
			
			if (!isNaN(min) && l < min) {
				return false;
			}
			
			if (!isNaN(max) && l > max) {
				return false;
			}
			
			return true;
		},
		'range'     : function (result, params) {
			var v     = parseFloat(this.val()),
				min   = parseFloat(params.min),
				max   = parseFloat(params.max);
													
			if (!isNaN(min) && v < min) {
				return false;
			}
			
			if (!isNaN(max) && v > max) {
				return false;
			}
			
			return true;
		},
		'equals'     : function (result, params) {
			//we don't want to cache elements that use this validator, because they depend on other fields that may be changed
			result.dontCache();
						
			return this.val() == this
				.parents('form:first')
				.find(params.selector)
				.val();
		},
		'regexp'     : function (result, params) {
			return params.regexp.test(this.val());
		},
		'checked'    : function (result) {
			//no point in caching it
			result.dontCache();
					
			return this.is(':checked');
		},
		'year'       : function (result) {
			var val = this.val();
			//we consider reasonable years as those between 1900 and 2100
			return /^[0-9]{4}$/.test(val) && val >= 1900 && val <= 2100;
		},
		'file'       : function (result, params) {
			var allowedExtensions = Array.isArray(params.extensions) ? params.extensions : [params.extensions],
				parts             = this.val().split('.');
						
			if (parts.length === 0) {
				return false; //chosen file has no extension
			} else if ($.inArray(parts.pop().toLowerCase(), allowedExtensions) > -1) {
				return true;
			} else {
				return false;
			}
		}
	};
	
	$.fn.yavp.messages = {
		'format'    : 'Incorrect format',
		'equals'    : "Fields don't match",
		'required'  : 'Required field',
		'checked'   : 'Please check this box',
		'range'     : function (params) {
			if (params.min && params.max) {
				return 'Please pick a number between ' + params.min + ' and ' + params.max;
			} else if (params.min) {
				return 'Please pick a number greater than ' + params.min;
			} else {
				return 'Please pick a number smaller than ' + params.max;
			}
		},
		'file'      : function (params) {
			var allowedExtensions = Array.isArray(params.extensions) ? params.extensions : [params.extensions];
		
			return 'Invalid file extension! Allowed file extensions include: '+allowedExtensions.join(', ');
		}	
	};
	
	
})(jQuery);

