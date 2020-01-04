'use strict';

/**
 * jQuery Ajax helpers on DOM ready.
 */
document.addEventListener('DOMContentLoaded', function(){
	initButtons();
}, false);

function initButtons() {
	// Close the modal window
	jQuery('.ckoModal .modal-content .close').click(function() {
		jQuery('.ckoModal .modal-content input').val('');
		jQuery('.ckoModal .modal-content span').not('.close, .label').empty();
		jQuery('.ckoModal').hide();
	});

	// Submit the action request
	jQuery('.ckoModal .modal-content .submit').click(function() {
		performAction(jQuery(this).parents().find('input'));
	});	
}

function openModal(elt) {
	// Prepare the origin element id members
	var members = elt.id.split('-');

	// Get the transaction data
	var tidExists = members[2] != null && members[2] != 'undefined';
	var isValidTid = members[2].length > 0 && members[2].indexOf('act_') == 0;
	if (tidExists && isValidTid) { 
		getTransactionData(members);
	}
	else {
		alert('The transaction ID is missing or invalid.');
	}
}

function getTransactionData(members) {
	// Prepare the controller URL for the AJAX request
	var controllerUrl = jQuery('[id="transactionsControllerUrl"]').val();

	// Set the transaction action
	var task = members[0];

	// Set the transaction id
	var transactionId = members[2];

	// Set the modal window id
	var modalId = '[id="' + task + '_modal"]';

	// Send the AJAX request
	jQuery.ajax({
		type: 'POST',
		url: controllerUrl,
		data: {tid: transactionId},
		success: function (data) {
			// Get the data
			var transaction = JSON.parse(data)[0];

			// Set the transation data field ids
			var field1Id = '[id="' + task + '_value"]';
			var field2Id = '[id="' + task + '_currency"]';
			var field3Id = '[id="' + task + '_transaction_id"]';
			var field4Id = '[id="' + task + '_full_amount"]';
			var field5Id = '[id="' + task + '_order_no"]';

			// Add the transation data to the fields
			jQuery(field1Id).val(transaction.amount);
			jQuery(field2Id).append(transaction.currency);
			jQuery(field3Id).append(transaction.transaction_id);
			jQuery(field4Id).append(transaction.amount + ' ' + transaction.currency);
			jQuery(field5Id).append(transaction.order_no);

			// Show the modal window
			jQuery(modalId).show();
		},
		error: function (request, status, error) {
			console.log(error);
		}
	});
}

function performAction(elt) {
	// Prepare the action URL
	var actionUrl = jQuery('[id="actionControllerUrl"]').val();

	// Prepare the origin element id members
	var members = elt.attr('id').split('-');

	// Get the transaction task
	var task = members[0];

	// Set the transaction id
	var transactionId = members[2];

	// Set the transaction value field id
	var fieldId = '[id="' + task + '_value"]';

	// Prepare the action data
	var data = {
		tid: transactionId,
		task: task,
		amount: jQuery(fieldId).val()
	}

	// Send the AJAX request
	jQuery.ajax({
		type: 'POST',
		url: actionUrl,
		data: data,
		success: function (res) {
			console.log(res);
		},
		error: function (request, status, error) {
			console.log(error);
		}
	});
}