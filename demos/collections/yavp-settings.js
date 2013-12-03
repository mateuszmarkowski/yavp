/*
You can keep all your validation logics and rules here and then use them in any other place just by including this file.
*/

$.fn.yavp.collections = {
	user : {
		name : { //you will be able to reference it using user.name
			selector  : '#name',
			validators: [
				'required',
				/^[a-z ]+$/i
			]
			
		},
		email : { //you will be able to reference it using user.email and so on
			selector  : '#email',
			validators: [
				'required',
				'email',
				'email_exists'
			]
		},
		email_secondary : {
			selector  : '#email_secondary',
			validators: [
				'optional',
				'email'
			]
		},
		password : {
			//any valid selector will do, this is equal to #date_of_birth in this demo
			selector  : 'input[name="password"]',
			/*
				once this field is validated, Yavp will proceed with validating "chained" elements
				In this case we want to revalidate password_confirm
			*/
			chain     : '#password_confirm',
			validators: [
				'required',
				'strong_password'
				
			]
		},
		password_confirm : {
			selector : '#password_confirm',
			//override the default error message for "equals" validator just for this element
			messages : {
				'equals' : "These passwords don't look similar!"
			},
			validators: [
				/*
					Since we want to pass additional params to the the validator, we can't just pass its name.
					Instead we pass a hash with "validator" key set to validator's name, and "selector" which will
					let Yavp find the field to compare
				*/
				{
					validator : 'equals',
					selector  : 'input[name="password"]'
				}
			]
		},
		tos : {
			selector  : '#tos',
			//let's override the default message
			messages  : {
				'checked' : 'You have to accept our rules!'	
			},
			validators: [
				'checked'
			]
		}
	}	
};

//define custom validator
$.fn.yavp.validators['strong_password'] = function (result) {
	var $element = this;
	
	//we're mixing two ways of passing validation result
	if ($element.val().length >= 4) {
		//normal synchronous way that lets us immediately pass false/true 
		return true;
	} else {
		//asynchronous way that lets us pass some additional params, such as error message 
		result.error('Password should be at least 4 characters long');
	}
};

//define custom validator
$.fn.yavp.validators['email_exists'] = function (result) {
	var $element = this;
	console.log($element.val(), this.val());
	//simulate an AJAX call using setTimeout with random interval
	setTimeout(function () {

		if ($element.val() == 'john@doe.net') {
			result.error('Email already in use!');
		} else {
			result.success();
		}
	}, Math.floor(Math.random() * 2000) + 1000);
	
};

//define what happens when element is successfully validated
$.fn.yavp.elementSuccess = function () {
	var $element    = this,
		$form_group = $element.parents('.form-group:first'),
		$help_block = $form_group.find('.help-block.yavp-error')
	
	if ($form_group.hasClass('has-error')) {
		$form_group.removeClass('has-error');
	}
	
	if ($help_block.length === 1) {
		$help_block.fadeOut('fast');
	}					
	
};

//define what happens when there's an error in an element
$.fn.yavp.elementError = function (message) {
	var $element    = this,
		$form_group = $element.parents('.form-group:first'),
		$help_block = $form_group.find('.help-block.yavp-error')
	
	if (!$form_group.hasClass('has-error')) {
		$form_group.addClass('has-error');
	}
	
	if ($help_block.length === 0) {
		$help_block = $('<span class="help-block yavp-error">').hide();
		$help_block.appendTo($form_group);
	}
	
	$help_block.text(message);

	if (!$help_block.is(':visible')) {
		$help_block.fadeIn('fast');
	}	
};

//let's add a nice spinning ball when a field is being validated
$.fn.yavp.elementBefore = function () {
	this.addClass('processing');
};

$.fn.yavp.elementAfter = function () {
	this.removeClass('processing');
};