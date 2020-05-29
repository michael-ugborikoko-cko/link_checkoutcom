"use strict"


// API Includes
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('dw/system/Logger');
var BasketMgr = require('dw/order/BasketMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var SystemObjectMgr = require('dw/object/SystemObjectMgr');
var Resource = require('dw/web/Resource');
var ServiceRegistry = require('dw/svc/ServiceRegistry');
var PaymentMgr = require('dw/order/PaymentMgr');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Site = require('dw/system/Site');

// Card Currency Config
var ckoCurrencyConfig = require('~/cartridge/scripts/config/ckoCurrencyConfig');

// Utility functions for my cartridge integration.
var ckoHelper = {

    /**
     * Get the required value for each mode
     */
    getAppModeValue: function (sandboxValue, liveValue) {
        var appMode = this.getValue('ckoMode');
        if (appMode == 'sandbox') {
            return sandboxValue;
        } else {
            return liveValue;
        }
    },
    
    /**
     * Get user language
     */
    getLanguage: function () {        
        return request.locale.replace('_', '-');
    },
    
    /**
     * Get Site Name
     */
    getSiteName: function () {        
        return dw.system.Site.getCurrent().name;
    },
    
    /**
     * Get site Hostname
     */
    getSiteHostName: function () {        
        return dw.system.Site.getCurrent().httpHostName;
    },
    
    /**
     * Check if the gateway response is valid
     */
    isValidResponse: function () {
        var requestKey = request.httpHeaders.get("authorization");
        var privateSharedKey = this.getAccountKeys().privateSharedKey;
        
        return requestKey == privateSharedKey;
    },   
    
    /**
     * Get value from custom preferences
     */
    getValue: function (field) {
        return CustomObjectMgr.getCustomObject('ckoSettings', Site.getCurrent().name).custom[field];
    },
    
    /**
     * Change Fist Letter of a string to UpperCase
     */
    upperCaseFirst: function (data) {
    	if(data){
        	var upperChar = data.charAt(0).toUpperCase();
        	
        	return data.replace(data.charAt(0), upperChar);
    	}
    },
    
    /**
     * Handles string translation with language resource files
     */
    _: function (strValue, strFile) {
        return Resource.msg(strValue, strFile, null);
    },
    
    /**
     * Write gateway information to the website's custom log files
     */
    doLog: function (dataType, gatewayData) {
        if (this.getValue("ckoDebugEnabled") == true) {
            var logger = Logger.getLogger('ckodebug');
            if (logger) {
                logger.debug(
                    this._('cko.gateway.name', 'cko') + ' ' + dataType + ' : {0}',
                    JSON.stringify(gatewayData)
                );
            }
        }
    },
    
    /**
     * Return order id
     */
    getOrderId: function () {
        var orderId = (this.getValue('cko3ds')) ? request.httpParameterMap.get('reference').stringValue : request.httpParameterMap.get('reference').stringValue;
        if (orderId === null) {
            orderId = session.privacy.ckoOrderId;
        }
        
        return orderId;
    },
    
    /**
     * Cartridge metadata
     */
    getCartridgeMeta: function () {
        return this.getValue("ckoUserAgent") + ' ' + this.getValue("ckoVersion");
    },
    
    /**
     * Get Account API Keys
     */
    getAccountKeys: function () {
        var keys = {};
        var str = this.getValue('ckoMode') == 'live' ? 'Live' : 'Sandbox';

        keys.publicKey = this.getValue('cko' + str + 'PublicKey');
        keys.secretKey = this.getValue('cko' +  str + 'SecretKey');
        keys.privateSharedKey = this.getValue('cko' +  str + 'PrivateSharedKey');

        return keys;
    },
    
    /**
     * Create an HTTP client to handle request to gateway
     */
    gatewayClientRequest: function (serviceId, requestData, method) {
        method = method || 'POST';
        var responseData = false;
        var serv = ServiceRegistry.get(serviceId);
        
        // Prepare the request URL and data
        if (requestData.hasOwnProperty('chargeId')) {
            var requestUrl = serv.getURL().replace('chargeId', requestData.chargeId);
            serv.setURL(requestUrl);
            delete requestData.chargeId;
        }

        // Set the request method
        serv.setRequestMethod(method);
        
        // Call the service
        var resp = serv.call(requestData);
        if (resp.status == 'OK') {
            responseData = resp.object;
        }
        
        return responseData;
    },
    
    /**
     * Currency Conversion Ratio
     */
    getCkoFormatedValue: function (currency) {
        if (ckoCurrencyConfig.x1.currencies.match(currency)) {
            return ckoCurrencyConfig.x1.multiple;
        } else if (ckoCurrencyConfig.x1000.currencies.match(currency)) {
            return ckoCurrencyConfig.x1000.multiple;
        } else {
            return 100;
        }
    },
    
    /**
     * Format price for cko gateway
     */
    getFormattedPrice: function (price, currency) {
        var ckoFormateBy = this.getCkoFormatedValue(currency);
        var orderTotalFormated = price * ckoFormateBy;
        
        return orderTotalFormated.toFixed();
    },
    
    /**
     * Get the Checkout.com orders
     */
    getOrders: function () {
    	
        // Prepare the output array
        var data = [];
    
        // Query the orders
        var result  = SystemObjectMgr.querySystemObjects('Order', '', 'creationDate desc');
        
        // Loop through the results
        for each(var item in result) {
        	
            // Get the payment instruments
            var paymentInstruments = item.getPaymentInstruments();
            
            // Loop through the payment instruments
            for each(var instrument in paymentInstruments) {
                if (this.isCkoItem(instrument.paymentMethod) && !this.containsObject(item, data)) {
                    data.push(item);
                }
            }
        }

        return data;
    },

    /**
     * Checks if an object already exists in an array
     */
    containsObject: function (obj, list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i] === obj) {
            	
                return true;
            }
        }

        return false;
    },

    /**
     * Checks if a payment instrument is Checkout.com
     */
    isCkoItem: function (item) {
    	
        return item.length > 0 && item.indexOf('CHECKOUTCOM_') >= 0;
    },

    /**
     * Get Order Quantities
     */
    getCurrency : function () {
        var orderId = this.getOrderId();
        
        // load the card and order information
        var order = OrderMgr.getOrder(orderId);
        var currency = order.getCurrencyCode();
        
        return currency;
    },

    /**
     * Removes white spaces form card number
     */
    getFormattedNumber: function (cardNumber) {
        return cardNumber.replace(/\s/g, "");
    },
    
    /**
     * Confirm is a payment is valid from API response code
     */
    paymentSuccess: function (gatewayResponse) {
    	if (gatewayResponse.hasOwnProperty('response_code')) {
    		
    		return gatewayResponse.response_code == "10000" || gatewayResponse.response_code == '10100' || gatewayResponse.response_code == '10200';
    	}else if(gatewayResponse.hasOwnProperty('actions')){
    		
    		return gatewayResponse.actions[0].response_code == "10000" || gatewayResponse.actions[0].response_code == '10100' || gatewayResponse.actions[0].response_code == '10200';	
    	}else if(gatewayResponse.hasOwnProperty('source')){
    		
    		return gatewayResponse.source.type == 'sofort' || 'bancontact';
    	}else if(gatewayResponse.hasOwnProperty('reference')){
    		
    		return gatewayResponse.reference == this.getOrderId();
    	}
    	
    	return false;
    },
    
    /**
     * Write order information to session for the current shopper
     */
    updateCustomerData: function (gatewayResponse) {
        if ((gatewayResponse) && gatewayResponse.hasOwnProperty('card')) {
            Transaction.wrap(function () {
                if (session.customer.profile !== null) {
                    session.customer.profile.custom.ckoCustomerId = gatewayResponse.card.customerId;
                }
            });
        }
    },
    
    /**
     * Handle a failed payment response
     */
    handleFail: function (gatewayResponse) {
        if (gatewayResponse) {
        	
            // Logging
            this.doLog(this._('cko.cartridge.failed', 'cko'), JSON.stringify(gatewayResponse));
        }

        // Send back to the error page
        ISML.renderTemplate('custom/common/response/failed.isml');
    },
    
    /**
     * Rebuild basket contents after a failed payment
     */
    checkAndRestoreBasket: function (order) {
        var basket = BasketMgr.getCurrentOrNewBasket();
        var it;
        var pli;
        var newPLI;
        var gcit;
        var gcli;
        var newGCLI;
        var billingAddress;
        var shippingAddress;
        
        if (order && basket && basket.productLineItems.size() === 0 && basket.giftCertificateLineItems.size() === 0) {
            Transaction.begin();
            
            it = order.productLineItems.iterator();
            
            while (it.hasNext()) {
                pli = it.next();
                newPLI = basket.createProductLineItem(pli.productID, basket.defaultShipment);
                newPLI.setQuantityValue(pli.quantity.value);
            }
            
            gcit = order.giftCertificateLineItems.iterator();
            while (gcit.hasNext()) {
                gcli = it.next();
                newGCLI = basket.createGiftCertificateLineItems(gcli.priceValue, gcli.recipientEmail);
                
                newGCLI.setMessage(gcli.message);
                newGCLI.setRecipientName(gcli.recipientName);
                newGCLI.setSenderName(gcli.senderName);
                newGCLI.setProductListItem(gcli.productListItem);
            }
            
            // Handle email address
            basket.customerEmail = order.customerEmail;
            
            // Handle billing address
            billingAddress = basket.createBillingAddress();
            billingAddress.firstName = order.billingAddress.firstName;
            billingAddress.lastName = order.billingAddress.lastName;
            billingAddress.address1 = order.billingAddress.address1;
            billingAddress.address2 = order.billingAddress.address2;
            billingAddress.city = order.billingAddress.city;
            billingAddress.postalCode = order.billingAddress.postalCode;
            billingAddress.stateCode = order.billingAddress.stateCode;
            billingAddress.countryCode = order.billingAddress.countryCode;
            billingAddress.phone = order.billingAddress.phone;
            
            // Handle shipping address
            shippingAddress = basket.defaultShipment.createShippingAddress();
            shippingAddress.firstName = order.defaultShipment.shippingAddress.firstName;
            shippingAddress.lastName = order.defaultShipment.shippingAddress.lastName;
            shippingAddress.address1 = order.defaultShipment.shippingAddress.address1;
            shippingAddress.address2 = order.defaultShipment.shippingAddress.address2;
            shippingAddress.city = order.defaultShipment.shippingAddress.city;
            shippingAddress.postalCode = order.defaultShipment.shippingAddress.postalCode;
            shippingAddress.stateCode = order.defaultShipment.shippingAddress.stateCode;
            shippingAddress.countryCode = order.defaultShipment.shippingAddress.countryCode;
            shippingAddress.phone = order.defaultShipment.shippingAddress.phone;
            
            // Handle shipping method
            basket.defaultShipment.setShippingMethod(order.defaultShipment.getShippingMethod());
            
            // Commit the transaction
            Transaction.commit();
        }
    },
    
    /**
     * Return customer object
     */
    getCustomer: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        
        // Customer object
        var customer = {
            email               : order.customerEmail,
            name                : order.customerName
        };
        
        return customer;
    },
    
    /**
     * Get Basket Quantities
     */
    getQuantity : function (args) {
    	
        // load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        var quantity = order.getProductQuantityTotal();
        
        return quantity; 
    },
    
    /**
     * Get Billing Descriptor Object from custom preferences
     */
    getBillingDescriptorObject : function () {
        var billingDescriptor = {
            "name"  : this.getValue('ckoBillingDescriptor1'),
            "city"  : this.getValue('ckoBillingDescriptor2')
        };
        
        return billingDescriptor;
    },
    
    /**
     * Get Products Information
     */
    getProductInformation : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        var it = order.productLineItems.iterator();
        var products = [];

        // Loop through the item
        while (it.hasNext()) {
            var pli = it.next();
            
            // product id
            var product = {
                "product_id"    : pli.productID,
                "quantity"      : pli.quantityValue,
                "price"         : this.getFormattedPrice(pli.adjustedPrice.value.toFixed(2), this.getCurrency()),
                "description"   : pli.productName
            };
            
            // Push to products array
            products.push(product);
        }
        if (this.getShippingValue(args)) {
            products.push(this.getShippingValue(args));
        }
        if (this.getTaxObject(args)) {
            products.push(this.getTaxObject(args));
        }
        
        return products;
    },
    
    /**
     * Return tax object
     */
    getTaxObject : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        
        // Prepare the tax data
        var tax = {
            "product_id"    : args.OrderNo,
            "quantity"      : 1,
            "price"         : this.getFormattedPrice(order.getTotalTax().valueOf().toFixed(2), this.getCurrency()),
            "description"   : "Order Tax"
        };
        
        // Test the order
        if (order.getTotalTax().valueOf() > 0) {
        	
            return tax;
        } else {
        	
            return false;
        }
    },
        
    /**
     * Return shipping object
     */
    getShippingValue : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get shipping address object
        var shipping = order.getDefaultShipment();
        
        // Check if shipping cost is applicable to this order
        if (shipping.getShippingTotalPrice().valueOf() > 0) {
            var shippment = {
                "product_id"    : shipping.getShippingMethod().getID(),
                "quantity"      : 1,
                "price"         : this.getFormattedPrice(shipping.adjustedShippingTotalPrice.value.toFixed(2), this.getCurrency()),
                "description"   : shipping.getShippingMethod().getDisplayName() + " Shipping : " + shipping.getShippingMethod().getDescription()
            };
            
            return shippment;
        } else {
        	
            return false;
        }
    },
    
    /**
     * Return Order Currency Code
     */
    getCurrencyCode: function (args) {
    	
        // Get the order
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get shipping address object
        var shipping = order.getDefaultShipment().getShippingMethod();
        var shippingCurrency = shipping.getCurrencyCode();
        
        return shippingCurrency;
    },

    /**
     * Get Product Names
     */
    getProductNames : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Prepare the iterator
        var it = order.productLineItems.iterator();

        // Prepare the product array
        var products = [];
        while (it.hasNext()) {
            var pli = it.next();
            products.push(pli.productName);
        }
        
        return products;
    },

    /**
     * Get Product price array
     */
    getProductPrices : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        
        // Get the product items
        var items = order.productLineItems.iterator();

        // Prepare the product array
        var products = [];
        while (items.hasNext()) {
            var item = items.next();
            products.push(item.getPriceValue());
        }
        
        return products;
    },
    
    /**
     * Get Product IDs
     */
    getProductIds : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        var it = order.productLineItems.iterator();
        var productIds = [];
        while (it.hasNext()) {
            var pli = it.next();
            productIds.push(pli.productID);
        }
        
        return productIds;
    },
    
    /**
     * Get Each Product Quantity
     */
    getProductQuantity : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        
        // Prepare the iterator
        var it = order.productLineItems.iterator();
        
        // Loop through the items
        var products_quantites = 0;
        while (it.hasNext()) {
            var pli = it.next();
            products_quantites += pli.quantityValue;
        }
        
        return products_quantites;
    },
        
    /**
     * Get Each Product Quantity
     */
    getProductQuantities : function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        
        // Prepare the iterator
        var it = order.productLineItems.iterator();

        // Loop through the items
        var products_quantites = [];
        while (it.hasNext()) {
            var pli = it.next();
            products_quantites.push(pli.quantityValue);
        }
        
        return products_quantites;
    },

    /**
     * Get Host IP
     */
    getHost: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);
        var host = order.getRemoteHost();
        
        return host;
    },

    /**
     * Return order amount
     */
    getAmount: function (order) {
        var amount = this.getFormattedPrice(order.totalGrossPrice.value.toFixed(2), this.getCurrency());
        
        return amount;
    },
    
    /**
     * Return phone object
     */
    getPhoneObject: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        
        // Creating phone object
        var phone = {
            country_code        : null,
            number              : billingAddress.getPhone()
        };
        
        return phone;
    },
    
    /**
     * Return Customer FullName
     */
    getCustomerName: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        var fullname = billingAddress.getFullName();
        
        return fullname;
    },
    
    /**
     * Return Customer FirstName
     */
    getCustomerFirstName: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        var firstname = billingAddress.getFirstName();
        
        return firstname;
    },
    
    /**
     * Return Customer LastName
     */
    getCustomerLastName: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        var lastname = billingAddress.getLastName();
        
        return lastname;
    },
    
    /**
     * Return AutoCapture
     */
    getCapture: function () {
    	return ckoHelper.getValue('ckoAutoCapture');
    },
        
    /**
     * Return capture time
     */
    getCaptureTime: function () {
    	
        // Get the current date/time in milliseconds
        var now = Date.now();

        // Get the capture time configured, or min time 0.5 minute if 0
        var configCaptureTime = this.getValue('ckoAutoCaptureTime');
        var captureOnMin = configCaptureTime > 0 ? configCaptureTime : 0.5;

        // Convert the capture time from minutes to milliseconds
        var captureOnMs = now + parseInt(captureOnMin) * 60000;

        // Convert the capture time to ISO 8601 format
        return new Date(captureOnMs).toISOString();
    },
    
    /**
     * Build 3ds object
     */
    get3Ds: function () {
    	
        // 3ds object
        var ds = {
            "enabled"               : this.getValue('cko3ds'),
            "attempt_n3d"           : this.getValue('ckoN3ds')
        };
        
        return ds;
    },
    
    /**
     * Build metadata object
     */
    getMetadataObject: function (data, args) {
    	
        // Prepare the base metadata
        var meta = {
            integration_data    : this.getCartridgeMeta(),
            platform_data       : this.getValue('ckoPlatformData')
        };

        // Add the data info if needed
        if (data.hasOwnProperty('type')) {
            meta.udf1 = data.type;
        }

        // Get the payment processor
        var paymentInstrument = args.PaymentInstrument;
        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

        // Add the payment processor to the metadata
        meta.payment_processor = paymentProcessor.getID();
    
        return meta;
    },
    
    /**
     * Build metadata object
     */
    getMetadataString: function (data, args) {
    	
        // Prepare the base metadata
        var meta = 'integration_data' + this.getCartridgeMeta() + 'platform_data' + this.getValue('ckoPlatformData');

        // Add the data info if needed
        if (data.hasOwnProperty('type')) {
            meta += 'udf1' + data.type;
        }

        // Get the payment processor
        var paymentInstrument = args.PaymentInstrument;
        var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();

        // Add the payment processor to the metadata
        meta += 'payment_processor' + paymentProcessor.getID();
    
        return meta;
    },
    
    /**
     * Build the Billing object
     */
    getBillingObject: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        
        // Creating billing address object
        var billingDetails = {
            address_line1       : billingAddress.getAddress1(),
            address_line2       : billingAddress.getAddress2(),
            city                : billingAddress.getCity(),
            state               : billingAddress.getStateCode(),
            zip                 : billingAddress.getPostalCode(),
            country             : billingAddress.getCountryCode().value
        };
        
        return billingDetails;
    },
    
    /**
     * Get Billing Country
     */
    getBillingCountry: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get billing address information
        var billingAddress = order.getBillingAddress();
        var country = billingAddress.getCountryCode().value;
        
        return country;
    },
    
    /**
     * Build the Shipping object
     */
    getShippingObject: function (args) {
    	
        // Load the card and order information
        var order = OrderMgr.getOrder(args.OrderNo);

        // Get shipping address object
        var shippingAddress = order.getDefaultShipment().getShippingAddress();
        
        // Creating address object
        var shippingDetails = {
            address_line1       : shippingAddress.getAddress1(),
            address_line2       : shippingAddress.getAddress2(),
            city                : shippingAddress.getCity(),
            state               : shippingAddress.getStateCode(),
            zip                 : shippingAddress.getPostalCode(),
            country             : shippingAddress.getCountryCode().value
        };
        
        // Shipping object
        var shipping = {
            address             : shippingDetails,
            phone               : this.getPhoneObject(args)
        };
        
        return shipping;
    },
    
    /**
     * Return Basket Item object
     */
    getBasketObject: function (basket) {
        var currency = this.getAppModeValue('GBP', basket.getCurrencyCode());
        var products_quantites = [];
        var it = basket.productLineItems.iterator();
        while (it.hasNext()) {
            var pli = it.next();
            var productTaxRate = pli.taxRate * 100 * 100;
            var productQuantity = pli.quantityValue;
            var unitPrice = Math.round(this.getFormattedPrice(pli.adjustedGrossPrice.value.toFixed(2), currency) / productQuantity);
            var totalAmount = this.getFormattedPrice(pli.adjustedGrossPrice.value, currency);
            var products = {
                "name"              : pli.productName,
                "quantity"          : productQuantity.toString(),
                "unit_price"        : unitPrice.toString(),
                "tax_rate"          : productTaxRate.toString(),
                "total_amount"      : totalAmount.toString(),
                "total_tax_amount"  : this.getFormattedPrice(pli.adjustedTax.value, currency)
            };
            
            products_quantites.push(products);
        }
        var shippingTaxRate = basket.defaultShipment.standardShippingLineItem.getTaxRate() * 100 * 100;
        var shipping = {
            "name"              : basket.defaultShipment.shippingMethod.displayName + " Shipping",
            "quantity"          : '1',
            "unit_price"        : this.getFormattedPrice(basket.shippingTotalGrossPrice.value, currency),
            "tax_rate"          : shippingTaxRate.toString(),
            "total_amount"      : this.getFormattedPrice(basket.shippingTotalGrossPrice.value, currency),
            "total_tax_amount"  : this.getFormattedPrice(basket.shippingTotalTax.value, currency)
        };
        
        if (basket.shippingTotalPrice.value > 0) {
            products_quantites.push(shipping);
        }
        
        return products_quantites;
    },
    
    /**
     * Return Basket Item object
     */
    getOrderBasketObject: function (args) {
    	
        // Prepare some variables
        var currency = this.getAppModeValue('GBP', this.getCurrencyCode(args));
        var order = OrderMgr.getOrder(args.OrderNo);
        var it = order.productLineItems.iterator();
        var products_quantites = [];
        
        // Iterate through the products
        while (it.hasNext()) {
            var pli = it.next();
            var productTaxRate = pli.taxRate * 100 * 100;
            var productQuantity = pli.quantityValue;
            var unitPrice = Math.round(this.getFormattedPrice(pli.adjustedGrossPrice.value.toFixed(2), currency) / productQuantity);
            var totalAmount = this.getFormattedPrice(pli.adjustedGrossPrice.value, currency);
            var products = {
                "name"              : pli.productName,
                "quantity"          : productQuantity.toString(),
                "unit_price"        : unitPrice.toString(),
                "tax_rate"          : productTaxRate.toString(),
                "total_amount"      : totalAmount.toString(),
                "total_tax_amount"  : this.getFormattedPrice(pli.adjustedTax.value, currency)
            };
            
            products_quantites.push(products);
        }

        // Set the shipping variables
        var shippingTaxRate = order.defaultShipment.standardShippingLineItem.getTaxRate() * 100 * 100;
        var shipping = {
            "name"              : order.defaultShipment.shippingMethod.displayName + " Shipping",
            "quantity"          : '1',
            "unit_price"        : this.getFormattedPrice(order.shippingTotalGrossPrice.value, currency),
            "tax_rate"          : shippingTaxRate.toString(),
            "total_amount"      : this.getFormattedPrice(order.shippingTotalGrossPrice.value, currency),
            "total_tax_amount"  : this.getFormattedPrice(order.shippingTotalTax.value, currency)
        };
        
        if (order.shippingTotalPrice.value > 0) {
            products_quantites.push(shipping);
        }
        
        return products_quantites;
    },
    
    /**
     * Return Basket Item CountryCode
     */
    getBasketCountyCode: function (basket) {
        var countyCode = basket.defaultShipment.shippingAddress.countryCode.valueOf();
        
        return countyCode;
    },
    
    /**
     * Return Basket Item CountryCode
     */
    getBasketAddress: function (basket) {
        var address = {
            given_name                  : basket.defaultShipment.shippingAddress.firstName,
            family_name                 : basket.defaultShipment.shippingAddress.lastName,
            email                       : null,
            title                       : basket.defaultShipment.shippingAddress.title,
            street_address              : basket.defaultShipment.shippingAddress.address1,
            street_address2             : basket.defaultShipment.shippingAddress.address2,
            postal_code                 : basket.defaultShipment.shippingAddress.postalCode,
            city                        : basket.defaultShipment.shippingAddress.city,
            phone                       : basket.defaultShipment.shippingAddress.phone,
            country                     : basket.defaultShipment.shippingAddress.countryCode.valueOf()
            
        };
        
        return address;
    },
    
    /**
     * Return Basket Item CountryCode
     */
    getOrderBasketAddress: function (args) {
        var order = OrderMgr.getOrder(args.OrderNo);
        var address = {
            given_name                  : order.defaultShipment.shippingAddress.firstName,
            family_name                 : order.defaultShipment.shippingAddress.lastName,
            email                       : order.customerEmail,
            title                       : order.defaultShipment.shippingAddress.title,
            street_address              : order.defaultShipment.shippingAddress.address1,
            street_address2             : order.defaultShipment.shippingAddress.address2,
            postal_code                 : order.defaultShipment.shippingAddress.postalCode,
            city                        : order.defaultShipment.shippingAddress.city,
            phone                       : order.defaultShipment.shippingAddress.phone,
            country                     : order.defaultShipment.shippingAddress.countryCode.valueOf()
        };
        
        return address;
    }
};

// Module exports
module.exports = ckoHelper;