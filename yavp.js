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
			$form_cache,
			$form,
			$element,
			has_errors,
			_continue,
			//used to generate unique names for anonymous validators
			anonymous_validator_index,
			//WE NEED TO CHANGE ITS NAME, IT'S CONFUSING
			selector_events = [];
			
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
			anonymous_validator_index = 100;
			
			if (typeof args[0] == 'function') {
				settings = $.extend(true, {}, settings, {
					success : args[0]
				});
			} else {
				//we don't want to overwrite Yavp static variables, so we create a new object
				settings = $.extend(true, {}, settings, args[0]);
			}
			
			$form.attr('novalidate', true); //prevent default browser validation
	
			function process_elements() {
				//if selector_events is not empty we need to clear all elements data, because user has used refresh
				var tmpArray,
					force_overwrite = selector_events.length > 0 ? true : false;
				
				//we have to collect all selectors so we can bind events to them using bind_events()
				selector_events = [];
				$form_cache     = $();
				
				$.each(settings.fields, function (index, field) {
					var element_settings = {},
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
						element_settings = settings.collections[tmpArray[0]][tmpArray[1]];
						
						//if it's an array, user passed only an array of validators and field name should be used as selector
						if (Array.isArray(element_settings)) {
							element_settings = {
								selector  : '[name="'+tmpArray[1]+'"]',
								validators: element_settings
							};
						}
						
					} else if (typeof field === 'object') {
						//user passed element settings instead of collection/field name
						element_settings = field;
					}
					
					//user may want to use only the selector he specified without any yavp addons such as :visible:enabled
					if (element_settings.selector_overwrite !== true) {
						element_settings.selector += ':visible:enabled';
					}
					
					//we have to find elements matched by this element's selector
					$elements = $form.find(element_settings.selector);
					
					if ($elements.length === 0) {
						//nothing found
						return;
					}

					if (force_overwrite || typeof $elements.data('yavp.validators') === 'undefined') {
						$elements.data('yavp.validators', []);
					}
					
					if (force_overwrite || typeof $elements.data('yavp.params') === 'undefined') {
						$elements.data('yavp.params', {});
					}
					
					if (typeof element_settings.chain !== 'undefined') {
						//yavp.chain contains a selector for elements that should be validated right after this element has been validated
						$elements.data('yavp.chain', element_settings.chain);
					}

					$.each(element_settings.validators, function (index, validator) {

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
							
						
							if (callback = resolve_validator(validator)) {
								$elements.data('yavp.validators').push({
									name     : validator,
									callback : callback
								});
							}

						} else if (typeof validator === 'object') {
							
							//user passed an object that contains a validator's name and some params maybe
							if (callback = resolve_validator(validator.validator)) {
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
								name     : 'anonymous-validator-' + (++anonymous_validator_index),
								callback : validator
							});
						}

					});
					
					//make sure it won't get overwritten when field is matched by more than one selector
					$elements.data('yavp.messages', element_settings.messages || {});
					
					if (settings.cache !== false || typeof element_settings.cache === 'undefined' ||
						(typeof element_settings.cache !== 'undefined' && element_settings.cache !== false)) {
						
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

					$form_cache = $form_cache.add($elements);
					selector_events.push(element_settings.selector);
				});
				
				//a shorthand to find validator in settings.validators
				function resolve_validator(validator) {
					return validator in settings.validators ? settings.validators[validator] : false;
				}
			}
	
			//binds events to all elements but form
			function bind_events() {
				var namespaced_events = (function (triggers) {
					//all our events should be namespaced
					$.each(triggers, function (index, value) {
						triggers[index] = value+'.yavp';
					});
					return triggers.join(' ');
				})(settings.triggers)
			
				//let's unbind all first
				$form.off(namespaced_events);
								
				//and bind again
				$form.on(
					namespaced_events,
					selector_events.join(','),
					settings.debounce ? debounce(validate, settings.debounce) : validate
				);
			}
			
			function debounce(callback, time) {
				var timeout,
					last_called = 0;
				
				return function () {
					var element = this,
						now     = (new Date).getTime(),
						args    = arguments;
									
					if (timeout && now - time < last_called) {
						clearTimeout(timeout);
						timeout = null;	
					}
	
					if (!timeout) {
						timeout = setTimeout(function () {
							callback.apply(element, Array.prototype.slice.call(args));
							timeout = null;
						}, time);
					}
					
					last_called = now;
				};
			}			
	
			function validate() {
				var promises       = [],
					main_deferred  = $.Deferred(),
					$form_or_field = $(this),
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
				
					var async_result,
						has_element_errors = false,
						$element           = $(element),
						validators         = $element.data('yavp.validators') ? $element.data('yavp.validators').slice() : [], //we need a copy
						//some validators may drop cache for all other validators, a good example is equals
						dont_cache         = false,
						element_deferred   = $.Deferred(); //element deferred
					
					if ($element.data('yavp.async_result') && $element.data('yavp.async_result').status === 'active') {
						//element is still being validated, i.e. AJAX request is in process, we need to make sure that the result will be ignored
						$element.data('yavp.async_result').revoke();
					}
					
					if (settings.elementBefore) {
						settings.elementBefore.call($element);
					}
								
					function apply_success() {
						var $this = $(this);
												
						//cache the current value, so we won't validate it again
						if (dont_cache === false && typeof $this.data('yavp.cache-success') === 'object') {
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
		
						if (dont_cache === false && typeof $this.data('yavp.cache-error') === 'object') {
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
								element_deferred.reject();
								return this;
							},
						
							//it will notify the main controller that because of used validator (like equals), we can't cache result
							dont_cache: function () {
								//dont_cache is also a variable included in the closure
								dont_cache = true;
							},
							//if we pass true as stop, we won't process further validatiors and  weill fire apply_success immedietaly 
							success : function (stop) {
								var stop = typeof stop === 'undefined' ? false : stop;
							
								if (this.status === 'inactive') {
									return this;
								}
								
								this.status = 'inactive';

								if (stop) {
									element_deferred.resolve();
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
					element_deferred.done(function () {
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
						(new AsyncResult($element, element_deferred, error.type)).error(error.message);
						return element_deferred.promise();
							
					}					
					
					//let's check with the success cache next
					if (typeof $element.data('yavp.cache-success') == 'object' &&
						$.inArray($element.val(), $element.data('yavp.cache-success')) > -1) {

						(new AsyncResult($element, element_deferred)).success();
						return element_deferred.promise();
							
					}		

					//we start checking next validator only if previous has been successful
					(function run_validator(validators) {
						if (!validators.length) {
							element_deferred.resolve();
							return;
						}
					
						var validator,
							result,
							validator_deferred = $.Deferred();
						
						validator_deferred.done(function () {
							run_validator(validators);
						}).fail(function () {
							element_deferred.resolve();
						});
						
						//get first remaining validator and run it
						validator    = validators.shift();
						
						//create async_result
						async_result = AsyncResult($element, validator_deferred, validator.name);
						
						//we need to store it, so to be able to revoke if user triggers validation again
						$element.data('yavp.async_result', async_result);
						
						//call validator in $element's context and pass its params
						result       = validator.callback.call(
							$element,
							async_result,
							$element.data('yavp.params')[validator.name] || {}
							//validator.name in $element.data('yavp.params') ? $element.data('yavp.params')[validator.name] : {}
						);

						//if user returns boolean, we can immedietaly handle result
						if (typeof result === 'boolean') {
							result === true ? async_result.success() : async_result.error();
						}
							
					})(validators);
				
					//only expose public interface
					return element_deferred.promise();
				}
								
				if ($form_or_field.prop('tagName').toLowerCase() === 'form') {
					//we are validating all fields like on submit
					$elements = $form_cache;
				} else {
					//we are validating a single element
					$elements = $form_or_field;
					
					//let's check if there're any other elements chained. If so, let's validate them as well
					if (typeof $form_or_field.data('yavp.chain') !== 'undefined') {
						$elements = $elements.add($form.find($form_or_field.data('yavp.chain')));
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
						main_deferred.resolve();
					});
				} else {
					main_deferred.resolve();
				}
	
				return main_deferred.promise();
			}
					
			$form.submit(function (e) {
				var form        = this,
					//we have to prevent the default's event, because we are async. That's why we give user a simulated event
					simulated_e = $.Event('submit', {
						target : form
					});
				
				e.preventDefault();
				
				//validate.call(form) will return a promise
				$.when(validate.call(form)).done(function (errors) {

					if (has_errors) {
						//form has validation errors, we have to check if there's an error callback specified
						if (typeof settings.error == 'function') {
							settings.error.call(form, simulated_e);
						}
					} else {
						//if user explicitly returns false, form won't be submitted
						_continue  = typeof settings.success == 'function' ?
							settings.success.call(form, simulated_e) !== false : true;
							
						if (_continue && !simulated_e.isDefaultPrevented()) {
							form.submit(); //skip jQuery interface
						}
					}

				});
				
			});
					
			process_elements();
			bind_events();
					
			//public methods
			$form.data('yavp', {
				//use that method when you're adding/removing fields from the form to flush yavp cache
				refresh : function () {
					process_elements();
					bind_events();
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
			result.dont_cache();
						
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
			result.dont_cache();
					
			return this.is(':checked');
		},
		'year'       : function (result) {
			var val = this.val();
			//we consider reasonable years as those between 1900 and 2100
			return /^[0-9]{4}$/.test(val) && val >= 1900 && val <= 2100;
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
		}			
	};
	
	
})(jQuery);

