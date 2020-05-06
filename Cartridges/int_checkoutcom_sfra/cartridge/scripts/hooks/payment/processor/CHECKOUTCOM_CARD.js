'use strict';

var collections = require('*/cartridge/scripts/util/collections');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var cardHelper = require('~/cartridge/scripts/helpers/cardHelper');

/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createToken() {
    return Math.random().toString(36).substr(2);
}

/**
 * Verifies that the payment data is valid.
 */
function Handle(basket, paymentInformation, processorId) {
    var currentBasket = basket;
    var cardErrors = {};
    var serverErrors = [];
    var cardIsValid = false;

    // Pre authorize the card
    if (!paymentInformation.creditCardToken) {
        cardIsValid = cardHelper.preAuthorizeCard(paymentInformation, currentBasket);
        if (!cardIsValid) {
            serverErrors.push(
                Resource.msg('error.card.information.error', 'creditCard', null)
            );

            return {
                fieldErrors: [cardErrors],
                serverErrors: serverErrors,
                error: true
            };
        }
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

        paymentInstrument.setCreditCardNumber(paymentInformation.cardNumber.value);
        paymentInstrument.setCreditCardType(paymentInformation.cardType.value);
        paymentInstrument.setCreditCardExpirationMonth(paymentInformation.expirationMonth.value);
        paymentInstrument.setCreditCardExpirationYear(paymentInformation.expirationYear.value);
        paymentInstrument.setCreditCardToken(
            paymentInformation.creditCardToken
                ? paymentInformation.creditCardToken
                : createToken()
        );
    });

    return {
        fieldErrors: cardErrors,
        serverErrors: serverErrors,
        error: false
    };
}

/**
 * Authorizes a payment using card details
 */
function Authorize(orderNumber, billingForm, processorId) {
    var serverErrors = [];
    var fieldErrors = {};

    // Payment request
    var success = cardHelper.handleRequest(
        orderNumber,
        billingForm.creditCardFields,
        processorId
    );

    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: !success
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createToken = createToken;
