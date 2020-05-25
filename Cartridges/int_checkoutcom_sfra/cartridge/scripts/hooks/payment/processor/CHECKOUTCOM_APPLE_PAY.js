'use strict';

var collections = require('*/cartridge/scripts/util/collections');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');

/** Utility **/
var ckoHelper = require('~/cartridge/scripts/helpers/ckoHelper');
var applePayHelper = require('~/cartridge/scripts/helpers/applePayHelper');

/**
 * Verifies that the payment data is valid.
 */
function Handle(basket, billingData, processorId, req) {
    var currentBasket = basket;
    var cardErrors = {};
    var serverErrors = [];

    // Verify the payload
    if (!billingData.paymentInformation.ckoApplePayData.value || billingData.paymentInformation.ckoApplePayData.value.length == 0) {
        serverErrors.push(
            Resource.msg('cko.applepay.error', 'cko', null)
        );

        return {
            fieldErrors: [cardErrors],
            serverErrors: serverErrors,
            error: true
        };
    }

    Transaction.wrap(function () {
        // Remove existing payment instruments
        var paymentInstruments = currentBasket.getPaymentInstruments(
            processorId
        );

        collections.forEach(paymentInstruments, function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        // Create a new payment instrument
        var paymentInstrument = currentBasket.createPaymentInstrument(
            processorId, currentBasket.totalGrossPrice
        );
    });

    return {
        fieldErrors: cardErrors,
        serverErrors: serverErrors,
        error: false
    };
}

/**
 * Authorizes a payment
 */
function Authorize(orderNumber, billingForm, processorId) {
    var serverErrors = [];
    var fieldErrors = {};

    // Payment request
    var success = applePayHelper.handleRequest(
        billingForm.applePayForm.ckoApplePayData.htmlValue,
        processorId,
        orderNumber
    );

    // Handle errors
    if (!success) {
        serverErrors.push(
            ckoHelper.getPaymentFailureMessage()
        );
    }

    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: !success
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;