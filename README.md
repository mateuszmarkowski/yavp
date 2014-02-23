# Yavp Documention - Easy Promise-Driven Validation

Yavp is intended to be as flexible and intuitive validation plugin as possible with vastly reduced learning curve.

## Basic Example
    
    
    $('#registration-form').yavp({
      fields : [
         {
            selector  : '[name="email"]', //any valid selector will do
            validators: [
               'required',
               'email'
            ]
         },
         {
            selector  : '[name="secondary_email"]',
            validators: [
               'optional', //if element's value is empty, further validators won't be processed
               'email'
            ]
         },
         {
            selector  : '[name="year_of_birth"]',
            validators: [
               'required',
               /^[0-9]{4}$/
            ]
         },
         {
            selector  : '[name="password"]',
            validators: [
               'required',
               function () {
                  //make sure the password is strong enough
                  if ($(this).val() != '123') {
                     return true;
                  } else {
                     return false;
                  }
                  
               }
            ]
         }
    
      ]
    
    }); 
    			

As you can see, Yavp lets you use previously defined (some are built-in) validators, build them off regular expressions and closures. And it's just a small piece of its functionality.

## Basis

All forms are validated solely based on settings passed to Yavp, HTML5 element types such as email or data- attributes will be ignored. Please note that Yavp will disable default browser's validation for forms that stay under its control.

Yavp offers you a possibility to reuse your validation rules in different pages. Imagine that you have a registration form for users, a very similiar form where they can change their account settings and an admin-backend form. Using other jQuery validation plugins, small differences between these forms will make it really difficult to reuse your code. With Yavp's collections, this task will be a piece of cake! 

Yavp makes cumbersome things easy so you can now easily make use of async AJAX calls. Also don't worry about validation requests generating heavy load on your server, Yavp implements debouncing and caching to cut down any unneccessary calls.

## Important Warning

Although this should be obvious, I think it's important to reiterate that client-side validation should never replace server-side one. Even if we setup secure validation rules with Yavp, you still need to validate the data again once actually sent to the server. A lot of damage can be done should you neglect it.

To cut the long story short, Yavp is just a fancy addition to improve user experience NOT website's security!

## Validators

Depending on the complexity of your project Yavp's built-in validators may suffice, but I'm pretty sure you can think of many unwieldy fields that need to be handled in a very specific way.

### Built-in Validators

Validator Params Description

optional
n/a
If a field is optional, you should use this validator as the very first one. Otherwise following validators will fail because of empty value. When your field uses optional and has no value, no further validators will be run.

required
n/a
Uses `$elment.val().length` to determine if a field is empty.

number
n/a
Number with no decimal places.

decimal
n/a
Number than may have decimal places.

name
n/a
Very generic name validator, valid may contain only letters and spaces.

email
n/a
Valid email address.

length

  * **min**: int
  * **max**: int

Validates value's length, requires at least one of the params.

range

  * **min**: float/int
  * **max**: float/int

Validates if field's value is within range defined by at least one of the params. Works well with **decimal** and **number**

equals

  * **selector**: string

This validator takes one param **selector** and compares its value to its own. Validation result is never cached.

regexp

  * **regexp**: RegExp object

Accepts **regexp** param and matches it against field's value.

checked
n/a
Returns true if element is checked.

year
n/a
Returns true if user passes a number that fits between 1900 and 2100 range.

### Regular expressions

Instead of using **regexp** validator you can just pass a RegExp object either using regular expression literal i.e. `/^[0-9]{1,4}$/` or using a RegExp constructor like this `new RegExp('^[0-9]{1,4}$')`.

### Closures (AKA anonymous functions)

On many occasions you will need to use your own validators and Yavp does a great job in making it as easy as possible. Not only you can pass validation result immediately by returning either true or false, but you can also make use of async function calls, let it be setTimeout or `$.ajax`. 

You will also be able to override global caching settings, prevent Yavp from executing following validators or even throw a custom error message.
    
    function (result, params) {}

Closure function will receive two arguments: result and params. Params is just a hash of data that you can specify when defining each validator, so instead of just using validators name like **email**.

Some validators require params to be passed, i.e.:
    
    
    {
       selector  : '[name="percentage"]',
       validator : 'range',
       max       : 100
    }

So in your closure function you access those params like this:
    
    
    function (result, params) {
       returun this.val() > params.min;
    }

Another important detail has been introduced in above example: all closures are executed in currently validated element's context. Using `$(this)` will be redundant as you will already get a jQuery object.

Let's focus on the first and slightly more sophisticated param - result.

  * `result.success()` - it's an equivalent of returning true but can be called aynchonously. If you pass true as an argument, no further validators will be processed
  * `result.error()` - call this if validation fails. Accepts a custom error message that will override any other specified for this element
  * `result.dontCache()` - indicates that the result of validation shouldn't be cached

Example use of "result" object:
    
    function (result, params) {
       $.post({
          url    : '/email-exists',
          data   : {
             email : this.val()
          },
          success: function (response) {
             if (response.status == 'success') {
                result.success();
             } else {
                result.error('Email already exists!');
             }
          },
          error  : function () {
             //not neccessary, but in case of server error we shouldn't stop user from submitting the form. Server validation should verify this
             result.success();
          }
       
       });
    }

You can also mix the use of result object with returning true/false:
    
    function (result, params) {
       if (!/[a-z]/i.test(this.val())) {
          result.error('Password should contain at least one letter');
       } else if (!/[0-9]/.test(this.val())) {
          result.error('Password should contain at least one digit');
       } else {
          return true; //equivalent to result.success();
       }
    }

In the above example `result` object was used to pass custom error message.

Sample situation when you may not want to cache validation value. Imagine it's a validator for `#zip` field which relies on `#city` field and we want to make sure that entered ZIP code is from the given city.
    
    function (result) {
       var city = $('#city').val(),
          zip  = this.val();
       
       //since this zip can be valid if city changes, we can't save validation result in the cache.
       result.dontCache();
       
       $.post({
          //our server side function will validate that this zip is within our city 
          url     : '/zip-in-city',
          data    : {
             city : city,
             zip  : zip
          },
          dataType: 'json',
          success : function (response) {
             if (response.status == 'success') {
                /*
                We can't just "return true" because $.post is an async call.
                return true could be used if you add "async: false" param to the $.post params.
                */
                
                result.success();
             } else {
                result.error('Please enter a ZIP code from '+city);
             }
          },
          //server error occured
          error   : function () {
             result.success();
          }
       });
    }

## Settings

Setting Description

success
callback when form is validated successfully. Context: **form**

error
callback when form validation fails. Context: **form**

elementSuccess
callback when form's element is validates successfully. Context: **current element**

elementError
callback when form's element validation fails. Context: **current element**

before
callback before validation starts

after
callback after validation is finished no matter what the result is

elementBefore
callback before element's validation starts

elementAfter
callback after element's validation is finished no matter what the result is

triggers
jQuery events such as **keydown**, **keyup**, **change** that will trigger validation of a form's element. Default: **keydown** and **change**

debounce
thanks to debouncing we can use i.e. **keydown** events without worrying of user triggering validation too often. Debounce will halt event callback execution until certain interval i.e. 350 miliseconds. If the same event does not fire within 350 milisends (i.e. user doesn't press a key), original callback will be executed. If the same event fires with 350 miliseonds, debounce will wait 350 miliseconds again. Accepts either interval param for debounce or false if you want to disable it. Default = 350

validators
you can pass your custom validators to override Yavp's default ones. If you just want to add some validators, please check Extending section

messages
same as above, but concerns messages

collections
same as above, but concerns collections

fields
an array of either validators or collection references. Fields have been explained in the next section

selectorOverwrite
Pass true if you don't want Yavp to add `:visible:enabled` to any of your selectors. Can by overwritten per each field.

## Defining fields

The're a few different ways of defining what Yavp is supposed to do with certain form element. Let's take a look at what you can pass to fields array:

### Collection reference

`user.date_of_birth` - simply a string where first part (before the dot) is the collection's name and the other is the field name. Please check Collections section to learn more details.

### A hash of field's settings

**selector** - valid jQuery selector used to match one or more DOM elements, i.e.: `[name="last_name"]`, `#period_start` or `.emails`

By default Yavp will append `:visible:enabled` to each selector to make sure that only fields that user can interact with will be validated. If you need to prevent Yavp from doing this, just set `selectorOverwrite` to true:
    
    fields : [
       {
          selector           : '[name="age"]',
          selectorOverwrite : true, //so that age will be validated even if hidden or disabled
          validators         : [
             'required'
          ]
          
       }
    ]

**validators** - an array of validators you want to apply to this field. These can be either just validator names with no details or hashes of data where you can specify some custom params, i.e.:
    
    fields : [
       {
          selector   : '[name="age"]',
          validators : [
             'required', //this one doesn't need any params
             {
                validator : 'range',
                min       : 18
             }
          ]
       
       }
    ]

**messages** - you can override global message settings, i.e.
    
    {
       validator : 'email',
       messages  : {
          format : 'Sorry, not a valid format!'
       }
    }

To learn more about messages please check Messages section.

**chain** - valid jQuery selector of field or fields which should be validated after this element has been validated. Useful for fields which rely on others. For example if you have a `#password` and `#cofirm_password` fields, you may want to re-validate `#confirm_password` in case user changes `#password`:
    
    fields : [
       {
          selector   : '#password',
          chain      : '#confirm_password',
          validators : [
             'required',
             function () {
                //some custom password validator
             }
          ]
       },
       {
          selector   : '#confirm_password',
          validators : [
             {
                validator : 'equals',
                selector  : '#password'
             }
          ]
       },
    
    ]

## Messages

Yavp will let you define your error messages on a few various levels. You can change them globally which is covered in the Extending section, per each form, field or per validator.

Message Type Description

equals
used if validation fails for **equals** validator

required
used when **required** field is empty

checked
used if required checkbox is not checked

range
used for **range** validator

format
a default error message if there's no other message specified

Generally if Yavp doesn't receive an error message from `result.error()` function, it will start searching for error message in field definition using validators name: 
    
    fields : [
       {
          selector  : '#name',
          validators: [
             'required',
             /^[a-z]+$/i
          ]
          messages  : {
             required : 'Your name is required!',
             regexp   : 'Not a valid name!'
          }   
       }
    ]

If you're after dynamically generated error messages, you can use closures instead of static strings. I.e.:
    
    messages : {
       'range'     : function (params) {
          if (params.min && params.max) {
             return 'Please pick a number between ' + params.min + ' and ' + params.max;
          } else if (params.min) {
             return 'Please pick a number greater than ' + params.min;
          } else {
             return 'Please pick a number smaller than ' + params.max;
          }
       }   
    }

Yavp will pass field's param as the first argument and set context to field's jQuery object like in validator functions.

When you need to overwrite all error messages for a certain form, you can just use messages param when initializing Yavp:
    
    $('#custom-form').yavp({
       //other settings
       messages : {
          format  : 'Some message',
          required: 'Please fill this field'
       }
    });

## Collections

Even if you have similar forms in a few places of your web applications, there're usually small differences between these. This shouldn't be a reason to just copy and paste the validation code though. Let's take a look what Yavp offers here.

A collection is basically a group of fields. Let's consider a "user" example. You know that in a registration form you require users to enter name, email and password. In their account settings you will probably want to split password settings from others. 

Let's define all validation fields in a collection under "users" name
    
    $.fn.yavp.collections.users = {
       //email is just for your reference, you could use anything like 'email-address'
       email : {
          selector   : '#email',
          validators : [
             'required',
             'email'
          ]
       },
       password : {
          selector  : '#password',
          validators: [
             'required'
          ]
       },
       password_confirm : {
          selector  : '#password_confirm',
          validators: {
             'required',
             {
                validator : 'equals',
                selector  : '#password'
             }
          }
       },
       name : {
          selector  : '#name',
          validators: [
             'required'
          ]
       }
    
    }
    

Now you can use any of the above in your forms:
    
    $('#registration-form').yavp({
       fields : [
          //Yavp will search for these rules in "users" collection
          'users.email',
          'users.password',
          'users.password_confirm',
          'users.name'
       ]
    });
    

Account settings form, we don't need password here, so we don't include it
    
    $('#account-form').yavp({
       fields : [
          'users.email',
          'users.name'
       ]
    });         
    

## Extending

Same like you can define your collections, Yavp lets you globally modify each of its settings so that it will be reflected in every form. The key is `$.fn.yavp` object which you can extend. Some examples:

Usually these two will be the same everywhere on your website, so why not to define them in one place? 
    
    $.fn.yavp.elementSuccess = function () {
       //your code
    };
    
    $.fn.yavp.elementError = function () {
       //your code
    };

If you want to add some validator:
    
    $.fn.yavp.validators.last_name = function () {
       //some code
    };

And it's the same as:
    
    $.fn.yavp.validators['last_name'] = function () {
    
    };

Should you need to modify a built-in validator, you can use the same method:
    
    $.fn.yavp.validators.email = function () {
       //some code
    };

You can also globally set message for validators:
    
    $.fn.yavp.messages.format = 'Incorrect format!';

## Solutions to Common Problems

Some of those are issues I've stumbled upon when working on my projects but majority of issues have been found googling for: `site:stackoverflow.com jquery validation "how to"`

### Checkbox "Range"

Say you want to let your users pick at least one but no more than two checkboxes.

Just wrap all your checkboxes with some container (i.e. span, div), in this case it's just a `div#newsletters`
    
    function (result) {
       //how many checkboxes have been checked?
       var checked = this
          .parents('#newsletters') //get reference to the wrapping container
          .find('[type="checkbox"]:checked') //find all checked checkboxes
          .length; //count them
          
       if (checked === 0) {
          result.error("Hey, pick at least one!");
       } else if (checked > 2) {
          result.error("No more than 2, please!");
       } else {
          return true;
       }
    }

### List of Errors

If you need a plain list of errors rather than displaying an error message for each invalid field, check this example.

`ul#errors` is a container where errors will be displayed.

Instead of using `elementError` callbacks we will focus on `error`. This one is called when validation fails and receives a list of all errors as a param.
    
    var $error_container = $('ul#errors');
    
    $('#form').yavp({
        error: function (errors) {
            $.each(errors, function (i, error) {
                $('<li>'+error.message+'</li>').appendTo($error_container);   
            });
        },
        fields: [
            //...
        ]
    });

This is nice and easy but needs to be adjusted. Yavp is generally designed to display inline error messages which can be more generic, i.e. "This field's incorrect". When you display a list of errors somewhere else, for example above the form, you should probably include field's label in error message, otherwise users won't know where they made a mistake.

There're two approaches to this problem, first one is more flexible and can save you some time if you have many fields. We will basically build error messages dynamically based on field's `label` tags. If your labels include some additional text like "Please enter your email", you could define actual field's label in a data- attribute:

`<label for="email" data-label="Email Address">Please enter your email address:</label>`

Now let's push some changes to build-in validators:
    
    /*You may need to adjust this function depending on your HTML structure.
    This one uses field's id attribute and seeks label with matching "for" attribute.*/
    
    function findLabel($field) {
        return $('label[for="'+$field.attr('id')+'"]')
            .data('label'); //or .text() depending on where you store field's name you want to use
    }
    
    $.fn.yavp.messages.required = function (params) {
        return findLabel(this)+' is required.'; //message callbacks are executed in field's context
    }
    
    $.fn.yavp.messages.format = function (params) {
        return findLabel(this)+' is incorrect.';
    }
    
    //and so on

If you need more control over your error messages, you can specify them explicitly for each field:
    
    $('#form').yavp({
        fields: [
            {
                selector  : '#name',
                messages  : {
                    required: 'We would love to know your name!'
                },
                validators: [
                    'required'
                ]
            },
            {
                selector  : '#email',
                messages  : {
                    required: "You surely have an email box, don't you?",
                    email   : "Our pigeon spotted a typo in your email!"
                },
                validators: [
                    'required',
                    'email'
                ]
            
            }
        ]
    });

### Dynamic Form

Sometimes, you may need to modify your form after yavp has been initiated. Since Yavp stores all form element references in a cache, it won't be able to reflect any DOM changes until you refresh its cache:

Add your element(s) first and then call:

`$('#your-form').yavp('refresh');`

Once this has been called, Yavp will process all form elements again including the ones you may have added or modified. Also remember that one field declaration can match unlimited number of DOM elemnts, just use class select i.e. `.name` instead of id or name.

### Ignore Default Values

If you for some reason want to use default values instead of placeholders, you can simply override **required** validator and add some data- attributes to specify default values.
    
    $.fn.yavp.validators.required = function () {
       if (this.val() == this.data('default-value')) {
          return false;
       }
    
       return this.val().length === 0 ? false : true;
    }

Then just don't forget to specify your default values in data-default-value attributes like this:

`<input type="text" name="name" value="John Doe" data-default-value="John Doe">`

### Radio Inputs

Please follow the Checkbox Range example.

### One Form Field Required

Sometimes you need users to fill at least one field and you don't care which one.

In this case you shouldn't really specify `elementError` callback but rather `error` and use this validator:
    
    $('#form').yavp({
       error  : function () {
          alert('At least one field should be filled!');
       },
       fields : [
          {
             selector  : 'input[type="text"]', //adjust this to match fields user can choose from
             validators: [
                function () {
                   var filled = (function ($fields) {
                      var _filled = 0;
                   
                      $fields.each(function () {
                         if ($(this).val().length > 0) {
                            _filled += 1;
                         }
                      });
                   
                      return _filled;
                   })(this.parents('form').find('input[type="text"]'));
                   
                   return filled > 0;
                }
             ]
          }
       ]
    });

### AJAX Form

More than often you will need a form sent asynchronously without refreshing the page. It's pretty straightforward:

### Mulitple Select

### Wizard

When you only need to validate a group of fields at once so user can proceed to the next step, please check the [Wizard][1] example.

   [1]: demos/wizard/
