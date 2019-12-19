'use strict';

/**
 * jQuery Ajax helpers on DOM ready.
 */
document.addEventListener('DOMContentLoaded', function(){
	buildTabs();
	buildTable();
}, false);

function buildTable() {
	// Prepare the table data
	var controllerUrl = jQuery('[id="transactionsControllerUrl"]').val();

	// Instantiate the table
	getTransactionData(controllerUrl);
}

function buildTabs() {
	// Get the active tab id
	var activeId = '[id="' + getCookie('ckoTabs') + '"]';
		
	// Activate current
	jQuery(activeId).removeClass('table_tabs_dis').addClass('table_tabs_en');
	jQuery(activeId).parent('td').removeClass('table_tabs_dis_background').addClass('table_tabs_en_background');
}

function setNavigationstate(path) {
	// Get the path members
	var members = path.split('/');
		
	// Set the cookie with controller name
	document.cookie = 'ckoTabs=' + members[members.length-1];
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function getTransactionData(controllerUrl) {
	jQuery.ajax({
		type: 'POST',
		url: controllerUrl,
		success: function (data) {
			initTable(data);
		},
		error: function (request, status, error) {
			console.log(error);
		}
	});
}

function initTable(tableData) {
	// Build the table instance
	var table = new Tabulator('#transactions-table', {
		height: 205,
		data: [JSON.parse(tableData)], 
		layout: 'fitColumns',
		columns: getTableColumns()
	});
}

function getTableColumns() {
	return [
		{title: 'Order No', field: 'order_no', width: 150},
		{title: 'Transaction Id', field:'transaction_id'},
		{title: 'Amount', field: 'amount'},
		{title: 'Date', field: 'creation_date'},
		{title: 'Type', field: 'type'},
		{title: 'Processor', field: 'processor'},
		{title: 'Actions', field: 'actions',
			headerSort: false,
			formatter: function (cell, formatterParams, onRendered) {
				return getButtonsHtml();
			}
		}
	];
}

function getButtonsHtml() {
	// Prepare the variable
	var html = '';
	
	// Build the auth button
	html += '<button type="button" id="auth_btn" id="auth_btn">Authorise</button>';
	html += '<button type="button" id="capt_btn" id="capt_btn">Capture</button>';
	html += '<button type="button" id="void_btn" id="void_btn">Void</button>';
	html += '<button type="button" id="refd_btn" id="refd_btn">Refund</button>';

	return html;
}

// Open the transaction modal view
function openModal(id) {
    var targetItemId = '#' + id;
    jQuery(targetItemId).css('display', 'block')
    .removeClass('modal-closed')
    .addClass('modal-opened');
}
  
// Close the transaction modal view
function closeModal(id) {
    var targetItemId = '#' + id;
    jQuery(targetItemId).css('display', 'none')
    .removeClass('modal-opened')
    .addClass('modal-closed');
}

function validateMax(elementId, amount) {
	var maxAmount = toFloat(amount);	
	var targetField = jQuery('#' + elementId);
    var currentAmount = toFloat(targetField.val());
    var finalAmount;
	
	if ((currentAmount > maxAmount) || currentAmount == 0) {
        finalAmount = maxAmount
    }
    else {
        finalAmount = currentAmount;
    }
    
    targetField.val(finalAmount);
}

function toFloat(val) {
    var output;
    
    if (val.constructor === String) {
        var parsed = /[+-]?\d+(?:\.\d+)?/g.exec(val);
        output = parsed === null ? 0 : parsed.pop()
    } else {
        return Math.abs(val).toFixed(2);
    }
    output = Math.abs(Number(output));
    if (String(output).split(".").length < 2 || String(output).split(".")[1].length<=2 ){
        output = output.toFixed(2);
    }
    
    return parseFloat(output).toFixed(2);
}
