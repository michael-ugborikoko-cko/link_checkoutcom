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
		jQuery('.ckoModal').hide();
	});
}

function openModal(elt) {
	var str = elt.id.split('_')[0];
	var modalId = str + '_modal';
	jQuery('[id="' + modalId + '"]').show();
}