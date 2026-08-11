// ── Commercial-lines form chassis (SCRUM-229) ──
// Specimen-grade synthetic wording only — fictional, not filed carrier text.
import type { FormChassis } from './chassisTypes.js';

export const COMMERCIAL_CHASSIS: Record<string, FormChassis> = {
  COMMERCIAL_CASUALTY: {
    key: 'COMMERCIAL_CASUALTY',
    documentKind: 'coverage-form',
    definitions: [
      {
        term: 'Insured',
        text: 'Throughout this policy the words you and your refer to the Named Insured shown in the Declarations, and the word Insured means any person or organization qualifying as such under the Who Is An Insured provisions of this Coverage Part.',
      },
      {
        term: 'Occurrence',
        text: 'Occurrence means an accident, including continuous or repeated exposure to substantially the same general harmful conditions.',
      },
      {
        term: 'Bodily Injury',
        text: 'Bodily Injury means bodily injury, sickness or disease sustained by a person, including death resulting from any of these at any time.',
      },
      {
        term: 'Property Damage',
        text: 'Property Damage means physical injury to tangible property, including all resulting loss of use of that property, or loss of use of tangible property that is not physically injured.',
      },
      {
        term: 'Products-Completed Operations Hazard',
        text: 'Products-Completed Operations Hazard includes all Bodily Injury and Property Damage occurring away from premises you own or rent and arising out of your product or your work, except products still in your physical possession or work that has not yet been completed or abandoned.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Coverage A - Bodily Injury And Property Damage Liability',
        text: 'We will pay those sums that the Insured becomes legally obligated to pay as damages because of Bodily Injury or Property Damage to which this insurance applies. We will have the right and duty to defend the Insured against any suit seeking those damages, but our right and duty to defend end when we have used up the applicable limit of insurance in the payment of judgments or settlements.',
      },
      {
        name: 'Coverage B - Personal And Advertising Injury Liability',
        text: 'We will pay those sums that the Insured becomes legally obligated to pay as damages because of personal and advertising injury to which this insurance applies, caused by an offense arising out of your business and committed in the coverage territory during the policy period.',
      },
      {
        name: 'Coverage C - Medical Payments',
        text: 'We will pay medical expenses for Bodily Injury caused by an accident on premises you own or rent, or because of your operations, provided the expenses are incurred and reported to us within one year of the date of the accident, regardless of fault.',
      },
    ],
    limitsNote:
      'The Limits of Insurance shown in the Declarations and the rules below fix the most we will pay regardless of the number of Insureds, claims made or suits brought, or persons or organizations making claims or bringing suits. The General Aggregate Limit is the most we will pay for the sum of all damages under Coverages A, B and C except damages included in the Products-Completed Operations Hazard, which are subject to their own aggregate limit, and the Each Occurrence Limit is the most we will pay for the sum of damages under Coverage A and medical expenses under Coverage C arising out of any one Occurrence.',
    exclusions: [
      {
        name: 'Expected Or Intended Injury',
        text: 'This insurance does not apply to Bodily Injury or Property Damage expected or intended from the standpoint of the Insured. This exclusion does not apply to Bodily Injury resulting from the use of reasonable force to protect persons or property.',
      },
      {
        name: 'Contractual Liability',
        text: 'This insurance does not apply to damages for which the Insured is obligated to pay by reason of the assumption of liability in a contract or agreement, other than liability the Insured would have in the absence of the contract or liability assumed in an insured contract.',
      },
      {
        name: 'Workers Compensation And Employers Liability',
        text: 'This insurance does not apply to any obligation of the Insured under a workers compensation, disability benefits or unemployment compensation law, or to Bodily Injury to an employee of the Insured arising out of and in the course of employment by the Insured.',
      },
      {
        name: 'Pollution',
        text: 'This insurance does not apply to Bodily Injury or Property Damage arising out of the actual, alleged or threatened discharge, dispersal, seepage, migration, release or escape of pollutants at or from any premises, site or location which is or was at any time owned, occupied, rented or loaned to any Insured.',
      },
      {
        name: 'Aircraft Auto Or Watercraft',
        text: 'This insurance does not apply to Bodily Injury or Property Damage arising out of the ownership, maintenance, use or entrustment to others of any aircraft, auto or watercraft owned or operated by or rented or loaned to any Insured.',
      },
      {
        name: 'Damage To Your Product Or Your Work',
        text: 'This insurance does not apply to Property Damage to your product arising out of it or any part of it, or to your work arising out of it or any part of it and included in the Products-Completed Operations Hazard.',
      },
      {
        name: 'Electronic Data',
        text: 'This insurance does not apply to damages arising out of the loss of, loss of use of, damage to, corruption of, inability to access, or inability to manipulate electronic data.',
      },
    ],
    conditions: [
      {
        name: 'Duties In The Event Of Occurrence Offense Claim Or Suit',
        text: 'You must see to it that we are notified as soon as practicable of an Occurrence or an offense which may result in a claim, including how, when and where it took place and the names and addresses of any injured persons and witnesses. No Insured will, except at that Insured’s own cost, voluntarily make a payment, assume any obligation, or incur any expense, other than for first aid, without our consent.',
      },
      {
        name: 'Other Insurance',
        text: 'If other valid and collectible insurance is available to the Insured for a loss we cover under this Coverage Part, this insurance is primary except when the Other Insurance provision states that it is excess, in which case we will pay only our share of the amount of loss that exceeds the sum of the total amount that all such other insurance would pay in the absence of this insurance.',
      },
      {
        name: 'Representations',
        text: 'By accepting this policy, you agree that the statements in the Declarations are accurate and complete, that those statements are based upon representations you made to us, and that we have issued this policy in reliance upon your representations.',
      },
      {
        name: 'Separation Of Insureds',
        text: 'Except with respect to the Limits of Insurance and any rights or duties specifically assigned to the first Named Insured, this insurance applies as if each Named Insured were the only Named Insured, and separately to each Insured against whom claim is made or suit is brought.',
      },
      {
        name: 'Transfer Of Rights Of Recovery',
        text: 'If the Insured has rights to recover all or part of any payment we have made under this Coverage Part, those rights are transferred to us, and the Insured must do nothing after loss to impair them.',
      },
    ],
    endorsements: [
      {
        suffixNo: '2037',
        title: 'Additional Insured - Completed Operations',
        body: 'A. Additional Insured. The person or organization shown in the Schedule is an Insured, but only with respect to liability for Bodily Injury or Property Damage caused, in whole or in part, by your work performed for that additional insured and included in the Products-Completed Operations Hazard.\nB. Limitation. The insurance afforded to the additional insured applies only to the extent required by the written contract or agreement, and will not be broader than the coverage this policy provides to you.\nC. Limits. The most we will pay on behalf of the additional insured is the amount of insurance required by the contract or the applicable Limits of Insurance shown in the Declarations, whichever is less.',
      },
      {
        suffixNo: '2405',
        title: 'Designated Premises Limitation',
        body: 'A. Limitation. This insurance applies only to Bodily Injury, Property Damage and personal and advertising injury arising out of the ownership, maintenance or use of the premises shown in the Schedule and operations necessary or incidental to those premises.\nB. Products Exception. This limitation does not apply to Bodily Injury or Property Damage included in the Products-Completed Operations Hazard arising out of goods or products manufactured at or distributed from the premises shown in the Schedule.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Business Description And Classification Codes',
      'Each Occurrence Limit',
      'General Aggregate Limit',
      'Products-Completed Operations Aggregate Limit',
      'Locations Of All Premises Owned Rented Or Occupied',
      'Total Advance Premium',
    ],
  },
  COMMERCIAL_PROPERTY: {
    key: 'COMMERCIAL_PROPERTY',
    documentKind: 'coverage-form',
    definitions: [
      {
        term: 'Covered Property',
        text: 'Covered Property means the building or structure described in the Declarations, your business personal property located in or on the building or in the open within one hundred feet of the described premises, and personal property of others in your care, custody or control at the described premises, as shown by a Limit of Insurance in the Declarations.',
      },
      {
        term: 'Covered Cause Of Loss',
        text: 'Covered Cause Of Loss means direct physical loss unless the loss is excluded or limited in this Coverage Part.',
      },
      {
        term: 'Business Income',
        text: 'Business Income means the net income that would have been earned or incurred had no direct physical loss occurred, plus continuing normal operating expenses, including payroll.',
      },
      {
        term: 'Period Of Restoration',
        text: 'Period Of Restoration means the period beginning seventy-two hours after the time of direct physical loss and ending on the date the property should be repaired, rebuilt or replaced with reasonable speed and similar quality, or the date business resumes at a new permanent location, whichever is earlier.',
      },
      {
        term: 'Vacancy',
        text: 'Vacancy means that less than thirty-one percent of a building’s total square footage is rented or used to conduct customary operations for sixty or more consecutive days before a loss.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Building And Business Personal Property',
        text: 'We will pay for direct physical loss of or damage to Covered Property at the premises described in the Declarations caused by or resulting from any Covered Cause Of Loss.',
      },
      {
        name: 'Business Income And Extra Expense',
        text: 'We will pay for the actual loss of Business Income you sustain due to the necessary suspension of your operations during the Period Of Restoration, and the necessary Extra Expense you incur to avoid or minimize that suspension, when the suspension is caused by direct physical loss at the described premises from a Covered Cause Of Loss.',
      },
      {
        name: 'Debris Removal',
        text: 'We will pay your expense to remove debris of Covered Property caused by a Covered Cause Of Loss, provided the expense is reported to us within one hundred eighty days of the loss, up to twenty-five percent of the amount we pay for the direct loss plus the applicable deductible.',
      },
    ],
    limitsNote:
      'The most we will pay for loss or damage in any one occurrence is the applicable Limit of Insurance shown in the Declarations for each item of Covered Property at each described premises. Payment is subject to the coinsurance provision shown in the Declarations, under which we will pay no greater proportion of the loss than the Limit of Insurance bears to the required percentage of the property’s value at the time of loss, and the deductible shown in the Declarations is subtracted from each adjusted loss.',
    exclusions: [
      {
        name: 'Earth Movement',
        text: 'We will not pay for loss caused directly or indirectly by earthquake, landslide, mine subsidence, or earth sinking, rising or shifting, regardless of any other cause or event contributing concurrently or in any sequence to the loss.',
      },
      {
        name: 'Flood',
        text: 'We will not pay for loss caused by flood, surface water, waves, tides, tidal water, overflow of any body of water, or spray from any of these, whether or not driven by wind, or by water that backs up or overflows from a sewer, drain or sump.',
      },
      {
        name: 'Ordinance Or Law',
        text: 'We will not pay for loss caused by the enforcement of any ordinance or law regulating the construction, use or repair of any property, or requiring the tearing down of any property, including the cost of removing its debris.',
      },
      {
        name: 'Wear Tear And Deterioration',
        text: 'We will not pay for loss caused by wear and tear, rust, corrosion, decay, deterioration, hidden or latent defect, smog, settling, cracking, shrinking or expansion, or nesting, infestation or damage by insects, birds, rodents or other animals.',
      },
      {
        name: 'Utility Services',
        text: 'We will not pay for loss caused by the failure of power, communication, water or other utility service supplied to the described premises if the failure originates away from the described premises.',
      },
      {
        name: 'Dishonest Acts',
        text: 'We will not pay for loss caused by or resulting from any dishonest or criminal act by you, any of your partners, members, officers, managers, employees or authorized representatives, whether acting alone or in collusion with others.',
      },
    ],
    conditions: [
      {
        name: 'Duties In The Event Of Loss Or Damage',
        text: 'You must give us prompt notice of the loss including a description of the property involved, take all reasonable steps to protect the Covered Property from further damage, keep a record of your expenses, permit us to inspect the property, and send us a signed, sworn proof of loss within sixty days after our request.',
      },
      {
        name: 'Valuation',
        text: 'We will determine the value of Covered Property at Actual Cash Value as of the time of loss, unless Replacement Cost is shown in the Declarations, in which case we will pay the cost to repair or replace with material of like kind and quality, but not until the property is actually repaired or replaced and unless the repair or replacement is made as soon as reasonably possible after the loss.',
      },
      {
        name: 'Appraisal',
        text: 'If we and you disagree on the value of the property or the amount of loss, either may make written demand for an appraisal; each party will select a competent and impartial appraiser, the appraisers will select an umpire, and a decision agreed to by any two will be binding.',
      },
      {
        name: 'Vacancy Condition',
        text: 'If the building where loss occurs has been in a state of Vacancy, we will not pay for loss caused by vandalism, sprinkler leakage, glass breakage, water damage, theft or attempted theft, and we will reduce the amount we would otherwise pay for any other covered loss by fifteen percent.',
      },
      {
        name: 'Mortgageholders',
        text: 'We will pay for covered loss to buildings to each mortgageholder shown in the Declarations in their order of precedence, and the mortgageholder’s right to receive payment will not be impaired by any act or neglect of the named insured, provided the mortgageholder pays any premium due at our request and notifies us of any known increase in hazard.',
      },
    ],
    endorsements: [
      {
        suffixNo: '3352',
        title: 'Utility Services - Direct Damage',
        body: 'A. Coverage. We will pay for direct physical loss to Covered Property at the described premises caused by an interruption of the utility service shown in the Schedule, when the interruption results from direct physical loss by a Covered Cause Of Loss to the property described in the Schedule that supplies that service.\nB. Overhead Transmission Lines. Coverage applies to interruption caused by loss to overhead transmission and distribution lines only if the Schedule so indicates.\nC. Limit. The most we will pay under this endorsement in any one occurrence is the limit shown in the Schedule, which is part of, and not in addition to, the Limit of Insurance applicable to the damaged property.',
      },
      {
        suffixNo: '3518',
        title: 'Spoilage Of Perishable Stock',
        body: 'A. Coverage. We will pay for loss of perishable stock at the described premises caused by a change in temperature or humidity resulting from mechanical breakdown of refrigerating or humidity-control equipment at the described premises, or from contamination by refrigerant.\nB. Limit And Deductible. The most we will pay in any one occurrence is the spoilage limit shown in the Schedule, and the spoilage deductible shown in the Schedule applies in place of any other deductible.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Described Premises And Building Construction Class',
      'Policy Period',
      'Building Limit Of Insurance',
      'Business Personal Property Limit',
      'Business Income Limit And Coinsurance Percentage',
      'Deductible Per Occurrence',
      'Total Advance Premium',
    ],
  },
  COMMERCIAL_AUTO: {
    key: 'COMMERCIAL_AUTO',
    documentKind: 'coverage-form',
    definitions: [
      {
        term: 'Covered Auto',
        text: 'Covered Auto means an auto of the type indicated by a covered auto designation symbol shown in the Declarations for each coverage, including autos you own, hire or borrow, and non-owned autos used in connection with your business, as those symbols provide.',
      },
      {
        term: 'Insured',
        text: 'Insured means you for any Covered Auto, and anyone else while using with your permission a Covered Auto you own, hire or borrow, except a person using a Covered Auto while working in the business of selling, servicing, repairing or parking autos unless that business is yours.',
      },
      {
        term: 'Accident',
        text: 'Accident includes continuous or repeated exposure to the same conditions resulting in Bodily Injury or Property Damage.',
      },
      { term: 'Loss', text: 'Loss means direct and accidental loss or damage.' },
      { term: 'Trailer', text: 'Trailer includes a semitrailer.' },
    ],
    insuringAgreements: [
      {
        name: 'Covered Autos Liability Coverage',
        text: 'We will pay all sums an Insured legally must pay as damages because of Bodily Injury or Property Damage to which this insurance applies, caused by an Accident and resulting from the ownership, maintenance or use of a Covered Auto. We have the right and duty to defend any Insured against a suit asking for such damages, but our duty to defend ends when the Liability Coverage Limit of Insurance has been exhausted by payment of judgments or settlements.',
      },
      {
        name: 'Physical Damage - Comprehensive Coverage',
        text: 'We will pay for Loss to a Covered Auto or its equipment from any cause except the Covered Auto’s collision with another object or its overturn, minus any applicable deductible shown in the Declarations.',
      },
      {
        name: 'Physical Damage - Collision Coverage',
        text: 'We will pay for Loss to a Covered Auto or its equipment caused by the Covered Auto’s collision with another object or by its overturn, minus any applicable deductible shown in the Declarations.',
      },
      {
        name: 'Towing And Labor',
        text: 'We will pay up to the limit shown in the Declarations for towing and labor costs incurred each time a Covered Auto of the private passenger type is disabled, provided the labor is performed at the place of disablement.',
      },
    ],
    limitsNote:
      'Regardless of the number of Covered Autos, Insureds, premiums paid, claims made or vehicles involved in the Accident, the most we will pay for the total of all damages resulting from any one Accident is the Liability Coverage Limit of Insurance shown in the Declarations. For Physical Damage, the most we will pay for Loss in any one Accident is the lesser of the Actual Cash Value of the damaged or stolen property at the time of Loss or the cost of repairing or replacing it with property of like kind and quality, minus the applicable deductible.',
    exclusions: [
      {
        name: 'Expected Or Intended Injury',
        text: 'This insurance does not apply to Bodily Injury or Property Damage expected or intended from the standpoint of the Insured.',
      },
      {
        name: 'Workers Compensation And Fellow Employee',
        text: 'This insurance does not apply to any obligation for which the Insured may be held liable under any workers compensation or similar law, or to Bodily Injury to any fellow employee of the Insured arising out of and in the course of the fellow employee’s employment.',
      },
      {
        name: 'Care Custody Or Control',
        text: 'This insurance does not apply to Property Damage to property owned or transported by the Insured, or in the Insured’s care, custody or control.',
      },
      {
        name: 'Movement Of Property By Device',
        text: 'This insurance does not apply to Bodily Injury or Property Damage resulting from the movement of property by a mechanical device, other than a hand truck, unless the device is attached to the Covered Auto.',
      },
      {
        name: 'Wear And Tear - Physical Damage',
        text: 'We will not pay for Loss caused by and confined to wear and tear, freezing, mechanical or electrical breakdown, or road damage to tires, unless caused by other Loss covered by this Coverage Form.',
      },
      {
        name: 'Racing',
        text: 'This insurance does not apply while a Covered Auto is used in any professional or organized racing or demolition contest or stunting activity, or while practicing or preparing for such contest or activity.',
      },
    ],
    conditions: [
      {
        name: 'Duties In The Event Of Accident Claim Suit Or Loss',
        text: 'You must see to it that we receive prompt notice of the Accident or Loss, including how, when and where it occurred and the names and addresses of any injured persons and witnesses. The Insured must cooperate with us in the investigation or settlement of the claim or defense against the suit, and must not, except at the Insured’s own cost, voluntarily make any payment or assume any obligation without our consent.',
      },
      {
        name: 'Appraisal For Physical Damage Loss',
        text: 'If you and we disagree on the amount of Loss, either may demand an appraisal; each party will select a competent appraiser, the two appraisers will select a competent and impartial umpire, and a decision agreed to by any two will be binding.',
      },
      {
        name: 'Other Insurance',
        text: 'For any Covered Auto you own, this Coverage Form provides primary insurance; for any Covered Auto you do not own, the insurance provided is excess over any other collectible insurance.',
      },
      {
        name: 'Policy Period Coverage Territory',
        text: 'We cover Accidents and Losses occurring during the policy period shown in the Declarations and within the coverage territory, which is the United States of America, its territories or possessions, Puerto Rico and Canada, and while a Covered Auto is being transported between any of these places.',
      },
    ],
    endorsements: [
      {
        suffixNo: '4472',
        title: 'Hired Auto Physical Damage Coverage',
        body: 'A. Coverage. Physical Damage Coverage indicated in the Schedule is extended to autos you hire, rent or borrow without a driver, subject to the limit and deductible shown in the Schedule.\nB. Loss Of Use. We will also pay expenses for which an Insured becomes legally responsible to the owner for loss of use of a hired auto, up to the daily and maximum amounts shown in the Schedule, provided the loss results from a cause of loss covered under the coverage indicated.\nC. Most We Will Pay. The most we will pay for Loss to any one hired auto is the lesser of its Actual Cash Value at the time of Loss, the cost to repair or replace it, or the limit shown in the Schedule.',
      },
      {
        suffixNo: '4590',
        title: 'Employees As Insureds',
        body: 'A. Provision. Any employee of yours is an Insured while using a Covered Auto you do not own, hire or borrow in your business or your personal affairs.\nB. Excess Insurance. For any covered auto used under this endorsement, the insurance provided is excess over any other collectible insurance available to the employee.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Covered Auto Designation Symbols By Coverage',
      'Schedule Of Owned Autos With Identification Numbers',
      'Liability Limit Of Insurance',
      'Comprehensive And Collision Deductibles',
      'Garaging Locations',
      'Total Advance Premium',
    ],
  },
  WORKERS_COMP: {
    key: 'WORKERS_COMP',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Workers Compensation Law',
        text: 'Workers Compensation Law means the workers or workmen’s compensation law and occupational disease law of each state or territory named in the Declarations, not including provisions for non-occupational disability benefits.',
      },
      {
        term: 'Bodily Injury By Accident',
        text: 'Bodily Injury By Accident means bodily injury, including resulting death, caused by an accident occurring during the policy period.',
      },
      {
        term: 'Bodily Injury By Disease',
        text: 'Bodily Injury By Disease means bodily injury, including resulting death, caused or aggravated by the conditions of employment, where the employee’s last day of last exposure to those conditions occurs during the policy period.',
      },
      {
        term: 'Remuneration',
        text: 'Remuneration means the payroll and all other forms of compensation paid or payable during the policy period for the services of persons engaged in operations covered by this policy, as defined by the manuals of rules and classifications we use.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Part One - Workers Compensation Insurance',
        text: 'We will pay promptly when due the benefits required of you by the Workers Compensation Law for Bodily Injury By Accident or Bodily Injury By Disease sustained by your employees arising out of and in the course of employment. We have the right and duty to defend at our expense any claim, proceeding or suit against you for those benefits.',
      },
      {
        name: 'Part Two - Employers Liability Insurance',
        text: 'We will pay all sums you legally must pay as damages because of Bodily Injury By Accident or Bodily Injury By Disease to your employees, arising out of and in the course of employment and occurring in the course of work that is necessary or incidental to your work in a state named in the Declarations, where recovery is permitted by law outside the Workers Compensation Law.',
      },
      {
        name: 'Part Three - Other States Insurance',
        text: 'If you begin work in any state listed in the Other States section of the Declarations after the effective date of this policy, and are not insured or self-insured for that work, all provisions of this policy will apply as though that state were listed in the Declarations, provided you notify us at once.',
      },
    ],
    limitsNote:
      'Our liability under Part One is unlimited except as the Workers Compensation Law itself limits the benefits payable. Under Part Two, our liability is limited to the amounts shown in the Declarations as the limit for Bodily Injury By Accident each accident, the limit for Bodily Injury By Disease policy limit, and the limit for Bodily Injury By Disease each employee, and these limits apply regardless of the number of employees, claims or persons entitled to damages.',
    exclusions: [
      {
        name: 'Serious And Willful Misconduct',
        text: 'Part Two does not cover liability for additional benefits or damages awarded because of your serious and willful misconduct.',
      },
      {
        name: 'Illegally Employed Persons',
        text: 'Part Two does not cover Bodily Injury to an employee employed in violation of law with your actual knowledge or the actual knowledge of any of your executive officers.',
      },
      {
        name: 'Punitive Damages',
        text: 'Part Two does not cover punitive or exemplary damages awarded because of Bodily Injury to an employee employed in violation of law.',
      },
      {
        name: 'Statutory Fines And Penalties',
        text: 'Part Two does not cover fines or penalties imposed for violation of federal or state law, or damages payable under any federal law imposing liability for discrimination against or termination of any employee.',
      },
      {
        name: 'Federal Acts',
        text: 'Part Two does not cover Bodily Injury to any person subject to the federal longshore, harbor workers, maritime or interstate railroad employers liability laws, or to a master or member of the crew of any vessel, unless coverage under those laws is added by endorsement.',
      },
      {
        name: 'Outside Employment Contracts',
        text: 'Part Two does not cover liability assumed under a contract, other than a warranty that your work will be done in a workmanlike manner.',
      },
    ],
    conditions: [
      {
        name: 'Your Duties If Injury Occurs',
        text: 'Tell us at once if injury occurs that may be covered by this policy, provide for immediate medical services required by the Workers Compensation Law, give us the names and addresses of the injured persons and of witnesses, and promptly give us all notices, demands and legal papers related to the injury, claim, proceeding or suit.',
      },
      {
        name: 'Premium And Audit',
        text: 'The premium shown in the Declarations is an estimate; the final premium will be determined after this policy ends by using the actual Remuneration and the proper classifications and rates. You will let us examine and audit your records related to this policy, including ledgers, journals, payroll records and tax reports, during the policy period and within three years after it ends.',
      },
      {
        name: 'Inspection',
        text: 'We have the right, but are not obliged, to inspect your workplaces at any time; our inspections relate only to insurability and premium, and we do not undertake to perform the duty of any person to provide for the health or safety of your employees or the public.',
      },
      {
        name: 'Recovery From Others',
        text: 'We have your rights, and the rights of persons entitled to the benefits of this insurance, to recover our payments from anyone liable for the injury, and you will do everything necessary to protect those rights for us.',
      },
      {
        name: 'Cancelation',
        text: 'You may cancel this policy by mailing or delivering advance written notice to us; we may cancel by mailing or delivering to you not less than ten days advance written notice stating when the cancelation is to take effect, or as otherwise required by the state law shown in the Declarations.',
      },
    ],
    endorsements: [
      {
        suffixNo: '5211',
        title: 'Voluntary Compensation And Employers Liability Coverage',
        body: 'A. Coverage. We will pay an amount equal to the benefits that would be required of you if you and the employees described in the Schedule were subject to the Workers Compensation Law shown in the Schedule, for Bodily Injury By Accident or Bodily Injury By Disease sustained by such employees arising out of and in the course of employment.\nB. Release. Before any amount is paid, the persons entitled to payment must release you and us, to the extent of the payment, from all responsibility for the injury or death, and must transfer to us their right of recovery from others.\nC. Failure To Accept. If the persons entitled to the benefits do not accept them and instead bring damage suits, Part Two of this policy applies to those suits.',
      },
      {
        suffixNo: '5340',
        title: 'Waiver Of Our Right To Recover From Others',
        body: 'A. Waiver. We have the right to recover our payments from anyone liable for an injury covered by this policy, but we will not enforce that right against the person or organization named in the Schedule, to the extent that you perform work under a written contract requiring this waiver.\nB. Premium. The premium charge for this waiver is the percentage shown in the Schedule of the premium developed on the payroll for the operations subject to the waiver.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'States Covered Under Part One',
      'Employers Liability Limits - Accident Disease Policy Disease Employee',
      'Other States Listing',
      'Classification Codes Estimated Remuneration And Rates',
      'Experience Modification Factor',
      'Estimated Annual Premium',
    ],
  },
  COMMERCIAL_CYBER: {
    key: 'COMMERCIAL_CYBER',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Computer System',
        text: 'Computer System means computers, hardware, software, firmware, virtual systems, and associated networking equipment operated by or on behalf of the Insured Organization, including cloud services operated by a third party under written contract with the Insured Organization.',
      },
      {
        term: 'Security Event',
        text: 'Security Event means unauthorized access to or use of a Computer System, a denial-of-service attack against a Computer System, or the introduction of malicious code into a Computer System.',
      },
      {
        term: 'Privacy Event',
        text: 'Privacy Event means the actual or reasonably suspected theft, loss or unauthorized disclosure of personally identifiable information or confidential corporate information in the care, custody or control of the Insured Organization or a service provider holding it on the Insured Organization’s behalf.',
      },
      {
        term: 'Extortion Threat',
        text: 'Extortion Threat means a credible threat to commit a Security Event, or to publish, transfer or misuse data taken from a Computer System, made against the Insured Organization for the purpose of demanding money or other consideration.',
      },
      {
        term: 'Business Interruption Loss',
        text: 'Business Interruption Loss means the net income the Insured Organization would have earned, plus continuing normal operating expenses including payroll, during the period of interruption resulting from a Security Event, less any saved expenses, after the waiting period shown in the Declarations.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Incident Response And Data Recovery',
        text: 'We will pay the reasonable and necessary fees of forensic investigators, breach counsel, notification vendors and credit monitoring services incurred by the Insured Organization in response to a Security Event or Privacy Event first discovered during the policy period, and the reasonable costs to restore or recover data and applications damaged by a Security Event.',
      },
      {
        name: 'Cyber Extortion',
        text: 'We will pay the reasonable costs incurred with our prior written consent to respond to an Extortion Threat first made during the policy period, including the fees of a qualified negotiation firm and, where legally permissible, extortion payments.',
      },
      {
        name: 'Business Interruption And Dependent Business Interruption',
        text: 'We will pay the Business Interruption Loss the Insured Organization sustains due to the interruption of its operations, or of the operations of a dependent business named in the Declarations, caused by a Security Event first discovered during the policy period.',
      },
      {
        name: 'Privacy And Network Security Liability',
        text: 'We will pay damages and claim expenses the Insured Organization becomes legally obligated to pay because of a claim first made during the policy period arising from a Privacy Event or Security Event, including liability arising from the failure to prevent the transmission of malicious code to a third party’s computer system.',
      },
      {
        name: 'Regulatory Proceedings',
        text: 'We will pay claim expenses and, where insurable by law, penalties and consumer redress amounts arising from a regulatory proceeding first commenced during the policy period alleging a violation of a privacy law in connection with a Privacy Event.',
      },
    ],
    limitsNote:
      'The Policy Aggregate Limit shown in the Declarations is the most we will pay for all loss, damages, claim expenses and costs under all insuring agreements combined, and each insuring agreement is subject to any sublimit shown in the Declarations, which is part of and not in addition to the Policy Aggregate Limit. The retention shown in the Declarations applies to each incident or claim, and all incidents or claims arising out of the same, continuous or related events are treated as a single incident or claim first discovered or made when the earliest of them was discovered or made.',
    exclusions: [
      {
        name: 'Prior Known Events',
        text: 'This policy does not apply to any incident, claim or circumstance of which any control group member had knowledge before the inception of the policy period, or that was noticed under any earlier policy.',
      },
      {
        name: 'Bodily Injury And Property Damage',
        text: 'This policy does not apply to bodily injury, sickness, disease or death of any person, or to physical damage to or destruction of tangible property, including loss of use; data is not tangible property.',
      },
      {
        name: 'Infrastructure Failure',
        text: 'This policy does not apply to loss arising out of the failure or outage of electrical, telecommunications, satellite or internet infrastructure not under the operational control of the Insured Organization or its contracted cloud provider.',
      },
      {
        name: 'War',
        text: 'This policy does not apply to loss arising out of war, invasion, or warlike operations by a sovereign state, except that this exclusion does not apply to a cyber operation that is not part of, or in preparation for, armed conflict, as determined by reasonable attribution evidence.',
      },
      {
        name: 'Intentional Acts Of Control Group',
        text: 'This policy does not apply to loss arising out of any deliberately fraudulent, criminal or malicious act of a control group member, if established by final adjudication.',
      },
      {
        name: 'Betterment',
        text: 'We will not pay costs to upgrade, redesign or otherwise improve a Computer System beyond its condition before the Security Event, other than reasonable measures required to remediate the specific vulnerability exploited.',
      },
      {
        name: 'Funds Transfer Loss',
        text: 'This policy does not apply to the loss of money or securities transferred from any account, unless coverage for fraudulent instruction loss is added by endorsement.',
      },
    ],
    conditions: [
      {
        name: 'Notice Of Incident Or Claim',
        text: 'The Insured Organization must notify us through the incident hotline or address shown in the Declarations as soon as practicable after a control group member first discovers an incident, and in no event later than sixty days after the end of the policy period; a claim must be reported as soon as practicable after it is first made.',
      },
      {
        name: 'Consent And Panel Providers',
        text: 'Except for emergency measures reasonably required in the first forty-eight hours to contain an incident, response costs are covered only if incurred with our prior written consent and, where a panel is shown in the Declarations, through panel providers unless we agree otherwise.',
      },
      {
        name: 'Defense And Settlement',
        text: 'We have the right and duty to defend any covered claim, and the Insured Organization may not settle any claim or admit liability without our prior written consent, which we will not unreasonably withhold.',
      },
      {
        name: 'Proof And Valuation Of Business Interruption Loss',
        text: 'Business Interruption Loss will be established by reference to the Insured Organization’s financial records for the periods before and after the interruption, with due allowance for seasonal and market trends, and a signed, sworn proof of loss must be submitted within ninety days after our request.',
      },
      {
        name: 'Subrogation',
        text: 'If we make any payment under this policy, we will be subrogated to all of the Insured Organization’s rights of recovery, and the Insured Organization will execute all papers required and do everything necessary to secure and preserve those rights.',
      },
    ],
    endorsements: [
      {
        suffixNo: '6120',
        title: 'Fraudulent Instruction And Funds Transfer Fraud',
        body: 'A. Coverage. We will pay the direct financial loss of money or securities sustained by the Insured Organization resulting from the transfer of funds by a financial institution in reliance on a fraudulent instruction transmitted to the institution by a person purporting to be the Insured Organization, or from an employee acting in good-faith reliance on a fraudulent instruction purporting to come from an executive or vendor, first discovered during the policy period.\nB. Verification Condition. Coverage under paragraph A. applies only if the Insured Organization verified any instruction to change payment details through a means other than the channel on which the instruction was received.\nC. Sublimit. The most we will pay under this endorsement is the sublimit shown in the Schedule, which is part of and not in addition to the Policy Aggregate Limit.',
      },
      {
        suffixNo: '6255',
        title: 'System Failure Business Interruption Extension',
        body: 'A. Extension. Business Interruption coverage is extended to interruption caused by an unplanned and unintentional outage of a Computer System resulting from an administrative or operational error of an employee, not involving a Security Event.\nB. Waiting Period And Sublimit. The separate waiting period and sublimit shown in the Schedule apply to loss covered by this extension.',
      },
    ],
    decItems: [
      'Insured Organization And Address',
      'Policy Period And Retroactive Date',
      'Policy Aggregate Limit',
      'Insuring Agreement Sublimits Schedule',
      'Retention Each Incident Or Claim',
      'Business Interruption Waiting Period',
      'Incident Response Hotline And Panel',
      'Total Policy Premium',
    ],
  },
  MANAGEMENT_LIABILITY: {
    key: 'MANAGEMENT_LIABILITY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured Persons',
        text: 'Insured Persons means all past, present and future directors, officers, managers, trustees and, with respect to the Employment Practices coverage part, employees of the Company, including their estates, heirs and legal representatives in the event of death or incapacity.',
      },
      {
        term: 'Claim',
        text: 'Claim means a written demand for monetary or non-monetary relief, a civil, criminal, administrative or regulatory proceeding commenced by service of a complaint or similar pleading, or, with respect to Insured Persons, a formal investigation commenced by the service of a subpoena or a written notice identifying the Insured Person as a target.',
      },
      {
        term: 'Wrongful Act',
        text: 'Wrongful Act means any actual or alleged error, misstatement, misleading statement, act, omission, neglect or breach of duty by an Insured Person in their capacity as such, or, with respect to entity coverage, by the Company; with respect to the Employment Practices coverage part, Wrongful Act means an employment practices violation; and with respect to the Fiduciary coverage part, a breach of the responsibilities imposed by employee benefit law.',
      },
      {
        term: 'Loss',
        text: 'Loss means damages, judgments, settlements, pre-judgment and post-judgment interest and Defense Expenses, but does not include civil or criminal fines or penalties imposed by law except where insurable, taxes, or matters uninsurable under the law pursuant to which this policy is construed.',
      },
      {
        term: 'Defense Expenses',
        text: 'Defense Expenses means reasonable and necessary fees, costs and expenses incurred with our consent in the investigation, defense or appeal of a Claim, excluding the salaries and wages of Insured Persons or employees of the Company.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Side A - Non-Indemnified Loss Of Insured Persons',
        text: 'We will pay on behalf of the Insured Persons the Loss resulting from a Claim first made during the policy period for a Wrongful Act, except for Loss the Company pays as indemnification.',
      },
      {
        name: 'Side B - Company Reimbursement',
        text: 'We will pay on behalf of the Company the Loss resulting from a Claim first made during the policy period against Insured Persons for a Wrongful Act, to the extent the Company has indemnified the Insured Persons for such Loss.',
      },
      {
        name: 'Employment Practices Liability',
        text: 'We will pay on behalf of the Insureds the Loss resulting from a Claim first made during the policy period alleging an employment practices violation, including wrongful termination, discrimination, harassment or retaliation, committed against an employee or applicant for employment.',
      },
      {
        name: 'Fiduciary Liability',
        text: 'We will pay on behalf of the Insureds the Loss resulting from a Claim first made during the policy period alleging a breach of fiduciary duty in the administration of an employee benefit plan sponsored by the Company.',
      },
    ],
    limitsNote:
      'The Aggregate Limit of Liability shown in the Declarations is the most we will pay for all Loss under all coverage parts combined for all Claims first made during the policy period, and any separate limit shown for a coverage part is part of and not in addition to the Aggregate Limit. Defense Expenses are part of and erode the applicable limit, and our obligation to pay ends when the limit is exhausted. The retention shown in the Declarations applies to each Claim, except that no retention applies to non-indemnified Loss of Insured Persons.',
    exclusions: [
      {
        name: 'Fraud And Personal Profit',
        text: 'We will not pay Loss arising from a Claim based upon a deliberately fraudulent or criminal act, or the gaining of any profit or advantage to which the Insured was not legally entitled, if established by final, non-appealable adjudication in the underlying proceeding.',
      },
      {
        name: 'Prior Notice And Pending Litigation',
        text: 'We will not pay Loss arising from any Claim based upon facts or circumstances noticed under any earlier policy, or upon any litigation, proceeding or investigation pending on or before the pending or prior date shown in the Declarations.',
      },
      {
        name: 'Insured Versus Insured',
        text: 'We will not pay Loss arising from a Claim brought by or on behalf of the Company against an Insured Person, other than a derivative claim brought without the solicitation or participation of any Insured, a claim brought by a bankruptcy trustee or examiner, or an employment practices Claim brought by an employee.',
      },
      {
        name: 'Bodily Injury And Property Damage',
        text: 'We will not pay Loss for bodily injury, sickness, disease or death of any person, or damage to or destruction of tangible property including loss of use; this exclusion does not apply to emotional distress alleged in an employment practices Claim.',
      },
      {
        name: 'ERISA Benefits Due',
        text: 'We will not pay benefits due or to become due under the terms of an employee benefit plan, except to the extent the Insured is a natural person and the benefits are payable as a personal obligation because of a wrongful denial established by adjudication.',
      },
      {
        name: 'Wage And Hour',
        text: 'We will not pay Loss arising from a Claim alleging a violation of any law governing wages, hours, overtime or employee classification, other than Defense Expenses up to the sublimit shown in the Declarations for such Claims.',
      },
    ],
    conditions: [
      {
        name: 'Notice Of Claim And Circumstances',
        text: 'The Insureds must give us written notice of a Claim as soon as practicable after the general counsel or risk manager first becomes aware of it, and in no event later than sixty days after the end of the policy period; the Insureds may also notice circumstances reasonably expected to give rise to a Claim, and any later Claim arising from them is deemed made when the circumstances were noticed.',
      },
      {
        name: 'Defense And Consent',
        text: 'The Insureds have the duty to defend Claims; we will advance Defense Expenses on a current basis, and the Insureds may not incur Defense Expenses, settle any Claim, or admit liability without our prior written consent, which will not be unreasonably withheld.',
      },
      {
        name: 'Allocation',
        text: 'If a Claim involves both covered and uncovered matters or parties, the Insureds and we will use reasonable efforts to agree on a fair allocation of Loss based on the relative legal and financial exposures of the parties to covered and uncovered matters.',
      },
      {
        name: 'Order Of Payments',
        text: 'If Loss payable under more than one insuring agreement exceeds the remaining limit, we will first pay non-indemnified Loss of Insured Persons, and only then any other Loss, and the Company may direct us to withhold payments otherwise due to the Company in favor of Insured Persons.',
      },
      {
        name: 'Extended Reporting Period',
        text: 'If this policy is cancelled or not renewed other than for nonpayment of premium, the named Company may purchase, for the additional premium shown in the Declarations, an extended period of up to one year to report Claims first made after the policy period for Wrongful Acts occurring before the end of the policy period.',
      },
    ],
    endorsements: [
      {
        suffixNo: '7130',
        title: 'Additional Side A Limit For Independent Directors',
        body: 'A. Additional Limit. We will pay an additional limit of liability, in the amount shown in the Schedule, solely for non-indemnified Loss of independent directors of the Company, which applies excess of the Aggregate Limit of Liability and excess of any other valid and collectible directors and officers insurance.\nB. Non-Rescindable. Coverage provided by this endorsement is non-rescindable by us for any reason.\nC. Priority. This additional limit is available to independent directors only after exhaustion of all other available limits and indemnification.',
      },
      {
        suffixNo: '7245',
        title: 'Third-Party Employment Practices Extension',
        body: 'A. Extension. The Employment Practices coverage part is extended to cover Loss from Claims brought by third parties, other than employees, alleging discrimination or harassment committed by an Insured in the conduct of the Company’s business.\nB. Retention. The separate retention shown in the Schedule applies to each Claim covered by this extension.',
      },
    ],
    decItems: [
      'Named Company And Principal Address',
      'Policy Period',
      'Aggregate Limit Of Liability',
      'Coverage Parts Purchased And Sublimits',
      'Retention Each Claim By Coverage Part',
      'Pending Or Prior Litigation Date',
      'Extended Reporting Period Premium',
      'Total Policy Premium',
    ],
  },
  PROFESSIONAL_LIABILITY: {
    key: 'PROFESSIONAL_LIABILITY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Professional Services',
        text: 'Professional Services means the services described in the Declarations performed by or on behalf of the Insured for others for a fee, including, where shown, healthcare services rendered by licensed practitioners and advisory services rendered in connection with a corporate transaction.',
      },
      {
        term: 'Claim',
        text: 'Claim means a written demand for money or services received by an Insured, or a civil proceeding commenced by service of a complaint, arising out of a Wrongful Act in the performance of Professional Services.',
      },
      {
        term: 'Wrongful Act',
        text: 'Wrongful Act means a negligent act, error or omission, or a personal injury offense, committed by an Insured solely in the performance of or failure to perform Professional Services.',
      },
      {
        term: 'Damages',
        text: 'Damages means the amounts an Insured is legally obligated to pay as the result of a covered judgment, award or settlement, but does not include the return, withdrawal or reduction of professional fees, fines, penalties, or matters uninsurable under applicable law.',
      },
      {
        term: 'Retroactive Date',
        text: 'Retroactive Date means the date shown in the Declarations on or after which a Wrongful Act must first have been committed for a Claim arising from it to be covered.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Professional Liability',
        text: 'We will pay on behalf of the Insured all Damages and claim expenses in excess of the deductible that the Insured becomes legally obligated to pay because of a Claim first made against the Insured during the policy period and reported to us as required, arising out of a Wrongful Act committed on or after the Retroactive Date.',
      },
      {
        name: 'Defense',
        text: 'We have the right and duty to defend any covered Claim, even if the allegations are groundless, false or fraudulent, with counsel of our choice; our duty to defend ends when the limit of liability has been exhausted by payment of Damages or claim expenses.',
      },
      {
        name: 'Disciplinary And Regulatory Proceedings',
        text: 'We will pay, up to the sublimit shown in the Declarations, the reasonable legal fees the Insured incurs in responding to a disciplinary, licensing or regulatory proceeding first commenced during the policy period arising out of the performance of Professional Services.',
      },
    ],
    limitsNote:
      'The Each Claim limit shown in the Declarations is the most we will pay for the sum of Damages and claim expenses for any one Claim, and the Aggregate limit is the most we will pay for all Claims first made during the policy period combined; claim expenses are part of and erode the limits. All Claims arising out of the same Wrongful Act or related Wrongful Acts are considered a single Claim first made when the earliest of them was made, and the deductible shown in the Declarations applies to each such single Claim and applies to both Damages and claim expenses.',
    exclusions: [
      {
        name: 'Dishonest Or Fraudulent Acts',
        text: 'This policy does not apply to any Claim arising out of a dishonest, fraudulent, criminal or malicious act or omission of an Insured, if established by final adjudication; we will defend such Claim until final adjudication.',
      },
      {
        name: 'Prior Knowledge',
        text: 'This policy does not apply to any Claim arising out of a Wrongful Act of which any principal, partner, officer or practice leader had knowledge before the inception date, where a reasonable person would have expected the Wrongful Act to give rise to a Claim.',
      },
      {
        name: 'Bodily Injury And Property Damage',
        text: 'This policy does not apply to bodily injury or property damage, except that with respect to healthcare Professional Services shown in the Declarations, this exclusion does not apply to bodily injury arising out of the rendering of or failure to render those healthcare services.',
      },
      {
        name: 'Contractual Guarantees',
        text: 'This policy does not apply to liability arising from any guarantee or warranty of results, cost estimates being exceeded, or the assumption of liability in a contract beyond that which the Insured would have at law absent the contract.',
      },
      {
        name: 'Insolvency',
        text: 'This policy does not apply to any Claim arising out of the insolvency or bankruptcy of the Insured or of any enterprise in which the Insured has an ownership interest exceeding ten percent.',
      },
      {
        name: 'Securities And Transactional Advice Carve-Out',
        text: 'For transactional advisory services, this policy does not apply to any Claim arising out of the actual purchase or sale of securities by the Insured for its own account, or the rendering of a fairness opinion unless that service is shown in the Declarations.',
      },
    ],
    conditions: [
      {
        name: 'Notice Of Claim',
        text: 'As a condition precedent to coverage, the Insured must give us written notice of a Claim as soon as practicable after it is first made, and in no event later than sixty days after the end of the policy period, together with every demand, notice, summons and pleading received.',
      },
      {
        name: 'Notice Of Potential Claim',
        text: 'If during the policy period the Insured becomes aware of a Wrongful Act that could reasonably be expected to give rise to a Claim and gives us written notice of the specifics, any Claim later arising from that Wrongful Act is deemed first made on the date of such notice.',
      },
      {
        name: 'Consent To Settle',
        text: 'We will not settle any Claim without the consent of the first named Insured; if the first named Insured refuses to consent to a settlement we recommend and the claimant would accept, our liability for that Claim will not exceed the amount of the recommended settlement plus claim expenses incurred to the date of the refusal.',
      },
      {
        name: 'Cooperation',
        text: 'The Insured must cooperate with us in the investigation, defense and settlement of any Claim, and must not admit liability, make any payment or assume any obligation without our prior written consent, except at the Insured’s own cost.',
      },
      {
        name: 'Extended Reporting Period',
        text: 'If this policy is cancelled or not renewed other than for nonpayment of premium or deductible, the first named Insured may purchase, within sixty days after the end of the policy period, an extended reporting period of the length and for the additional premium shown in the Declarations, applying to Claims first made during that period for Wrongful Acts committed before the end of the policy period.',
      },
    ],
    endorsements: [
      {
        suffixNo: '8150',
        title: 'Named Subcontractor Vicarious Liability',
        body: 'A. Coverage. The insurance afforded by this policy extends to the Insured’s vicarious liability for Wrongful Acts committed by the subcontractor named in the Schedule while performing Professional Services on the Insured’s behalf under written contract.\nB. No Direct Coverage. The named subcontractor is not an Insured, and no coverage applies to Claims brought by the Insured against the subcontractor or by the subcontractor against the Insured.',
      },
      {
        suffixNo: '8275',
        title: 'Telehealth Services Extension',
        body: 'A. Extension. Professional Services is extended to include healthcare consultation, diagnosis and treatment recommendations delivered by the Insured through remote audio, video or electronic means to patients located in jurisdictions where the Insured is licensed or otherwise authorized to practice.\nB. Conditions. This extension applies only while the Insured maintains the informed-consent and record-keeping procedures described in its application.\nC. Sublimit. The separate sublimit shown in the Schedule applies to all Claims arising out of services covered by this extension.',
      },
    ],
    decItems: [
      'Named Insured And Principal Address',
      'Description Of Professional Services',
      'Policy Period And Retroactive Date',
      'Limit Of Liability Each Claim',
      'Aggregate Limit Of Liability',
      'Deductible Each Claim',
      'Extended Reporting Period Option And Premium',
      'Total Policy Premium',
    ],
  },
  COMMERCIAL_UMBRELLA: {
    key: 'COMMERCIAL_UMBRELLA',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Underlying Insurance',
        text: 'Underlying Insurance means the policies listed in the Schedule Of Underlying Insurance and any renewals or replacements of them, providing the underlying limits the Declarations require the Insured to maintain.',
      },
      {
        term: 'Retained Limit',
        text: 'Retained Limit means the total applicable limits of the Underlying Insurance and any other insurance available to the Insured, or the self-insured retention shown in the Declarations with respect to loss not covered by any Underlying Insurance or other insurance.',
      },
      {
        term: 'Ultimate Net Loss',
        text: 'Ultimate Net Loss means the total sum the Insured becomes legally obligated to pay as damages, after making deductions for all recoveries and salvage, because of injury or damage to which this policy applies.',
      },
      {
        term: 'Occurrence',
        text: 'Occurrence means an accident, including continuous or repeated exposure to substantially the same general harmful conditions, that results in bodily injury or property damage neither expected nor intended from the standpoint of the Insured.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Excess Follow-Form Liability',
        text: 'We will pay on behalf of the Insured the Ultimate Net Loss in excess of the Retained Limit that the Insured becomes legally obligated to pay because of bodily injury, property damage, or personal and advertising injury to which this policy applies, caused by an Occurrence during the policy period; except as otherwise stated in this policy, coverage follows the terms, definitions, conditions and exclusions of the applicable Underlying Insurance.',
      },
      {
        name: 'Umbrella Liability Over The Self-Insured Retention',
        text: 'With respect to injury or damage covered by this policy but not covered by any Underlying Insurance or other insurance, we will pay the Ultimate Net Loss in excess of the self-insured retention shown in the Declarations.',
      },
      {
        name: 'Defense',
        text: 'When the applicable limits of Underlying Insurance have been exhausted by payment of judgments or settlements, or when the loss is covered by this policy but not by any Underlying Insurance, we will have the right and duty to defend any suit against the Insured seeking damages to which this policy applies.',
      },
    ],
    limitsNote:
      'The Each Occurrence Limit shown in the Declarations is the most we will pay for the sum of all Ultimate Net Loss arising out of any one Occurrence, and the Aggregate Limit is the most we will pay for all Ultimate Net Loss during the policy period other than loss arising from the auto liability hazard, regardless of the number of Insureds, claims made or suits brought. If the aggregate limits of the Underlying Insurance are reduced or exhausted by payment of claims, this policy will drop down and apply in excess of the reduced or exhausted limits, but not broader than its own terms.',
    exclusions: [
      {
        name: 'Expected Or Intended Injury',
        text: 'This policy does not apply to bodily injury or property damage expected or intended from the standpoint of the Insured, except bodily injury resulting from the use of reasonable force to protect persons or property.',
      },
      {
        name: 'Workers Compensation And Similar Laws',
        text: 'This policy does not apply to any obligation of the Insured under a workers compensation, disability benefits, unemployment compensation or similar law.',
      },
      {
        name: 'Pollution',
        text: 'This policy does not apply to injury or damage arising out of the discharge, dispersal, seepage, migration, release or escape of pollutants, nor to any cost of testing for, monitoring, cleaning up, removing or neutralizing pollutants, except to the extent such coverage is provided by the Underlying Insurance and then no broader than that Underlying Insurance.',
      },
      {
        name: 'Aircraft And Watercraft',
        text: 'This policy does not apply to injury or damage arising out of the ownership, maintenance or use of any aircraft, or of watercraft over fifty feet in length, owned by or chartered without crew to any Insured, unless covered by Underlying Insurance listed in the Schedule.',
      },
      {
        name: 'Damage To Impaired Property',
        text: 'This policy does not apply to property damage to impaired property, or property that has not been physically injured, arising out of a defect, deficiency or inadequacy in your product or your work, or a delay in performing a contract.',
      },
      {
        name: 'Uninsurable Fines And Penalties',
        text: 'This policy does not apply to civil or criminal fines, penalties or punitive damages where uninsurable under the law applicable to the construction of this policy.',
      },
    ],
    conditions: [
      {
        name: 'Maintenance Of Underlying Insurance',
        text: 'The Insured must maintain the Underlying Insurance in full force during the policy period at the limits shown in the Schedule, without material change in terms; failure to do so will not invalidate this policy, but we will be liable only to the extent we would have been had the Underlying Insurance been maintained.',
      },
      {
        name: 'Notice Of Occurrence',
        text: 'The Insured must give us written notice as soon as practicable of any Occurrence reasonably likely to involve this policy, and must immediately forward to us every demand, notice, summons or other process received if suit is brought.',
      },
      {
        name: 'Loss Payable',
        text: 'Liability under this policy does not attach until the amount of the Retained Limit has been paid by or on behalf of the Insured, and we will then pay the Ultimate Net Loss in excess of the Retained Limit within thirty days after it is finally determined by judgment or written settlement agreement.',
      },
      {
        name: 'Appeals',
        text: 'If the Insured or an underlying insurer elects not to appeal a judgment in excess of the Retained Limit, we may elect to do so at our own expense, and our liability will not exceed our applicable limit of liability plus the costs and interest incidental to the appeal.',
      },
      {
        name: 'Other Insurance',
        text: 'This insurance is excess over any other valid and collectible insurance available to the Insured, whether primary, excess or contingent, other than insurance purchased specifically to apply in excess of this policy.',
      },
    ],
    endorsements: [
      {
        suffixNo: '9140',
        title: 'Foreign Liability Difference-In-Conditions Extension',
        body: 'A. Extension. With respect to Occurrences taking place outside the coverage territory of the Underlying Insurance, this policy will pay the Ultimate Net Loss that would have been covered by the Underlying Insurance had the Occurrence taken place within its territory, in excess of the self-insured retention shown in the Schedule.\nB. Local Admitted Policies. Where a locally admitted policy applies, this endorsement applies in excess of, and no broader than, the local policy, as if that policy were Underlying Insurance.\nC. Currency. Losses payable under this endorsement will be paid in United States dollars at the rate of exchange published on the date the amount of loss is finally determined.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Each Occurrence Limit',
      'Aggregate Limit',
      'Self-Insured Retention',
      'Schedule Of Underlying Insurance With Required Limits',
      'Premium Basis And Rate',
      'Total Advance Premium',
    ],
  },
  PACKAGE_BOP: {
    key: 'PACKAGE_BOP',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured',
        text: 'Throughout this policy the words you and your refer to the Named Insured shown in the Declarations; the word Insured also includes your employees for acts within the scope of their employment, and any person or organization qualifying under the Who Is An Insured provisions of the Liability section.',
      },
      {
        term: 'Covered Property',
        text: 'Covered Property means the buildings and business personal property described in the Declarations at the described premises, including tenant improvements and betterments in which you have a use interest.',
      },
      {
        term: 'Business Income',
        text: 'Business Income means the net income that would have been earned had no direct physical loss occurred, plus continuing normal operating expenses, including payroll, during the period of restoration.',
      },
      {
        term: 'Occurrence',
        text: 'Occurrence means an accident, including continuous or repeated exposure to substantially the same general harmful conditions, resulting in bodily injury or property damage.',
      },
      {
        term: 'Money And Securities',
        text: 'Money And Securities means currency, coins, bank notes, checks, money orders and evidences of debt or ownership of property, whether or not in current use.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Section I - Property Coverage',
        text: 'We will pay for direct physical loss of or damage to Covered Property at the premises described in the Declarations caused by or resulting from any covered cause of loss, which means direct physical loss unless excluded or limited under this policy.',
      },
      {
        name: 'Section I - Business Income And Extra Expense',
        text: 'We will pay the actual loss of Business Income you sustain due to the necessary suspension of your operations during the period of restoration caused by direct physical loss at the described premises from a covered cause of loss, and the necessary extra expense you incur to avoid or minimize the suspension, for up to twelve consecutive months without a specific dollar limit unless one is shown in the Declarations.',
      },
      {
        name: 'Section II - Business Liability Coverage',
        text: 'We will pay those sums that the Insured becomes legally obligated to pay as damages because of bodily injury, property damage or personal and advertising injury to which this insurance applies, and we will have the right and duty to defend the Insured against any suit seeking those damages, until we have used up the applicable limit of insurance in the payment of judgments or settlements.',
      },
      {
        name: 'Section II - Medical Expenses',
        text: 'We will pay medical expenses for bodily injury caused by an accident on premises you own or rent or because of your operations, regardless of fault, provided the expenses are incurred and reported to us within one year of the date of the accident.',
      },
    ],
    limitsNote:
      'The most we will pay for property loss in any one occurrence is the Limit of Insurance shown in the Declarations for the affected item of Covered Property, subject to automatic seasonal increase of business personal property of twenty-five percent when values fluctuate. The Liability And Medical Expenses limit shown in the Declarations is the most we will pay for the sum of all damages under Section II because of any one Occurrence, and the Liability Aggregate is twice that limit; the property deductible shown in the Declarations applies to each occurrence of property loss but not to Business Income.',
    exclusions: [
      {
        name: 'Earth Movement And Flood',
        text: 'Under Section I, we will not pay for loss caused directly or indirectly by earthquake, landslide, earth sinking or shifting, flood, surface water, or water that backs up from a sewer or drain, regardless of any other contributing cause, unless coverage is added by endorsement.',
      },
      {
        name: 'Ordinance Or Law',
        text: 'Under Section I, we will not pay for loss caused by the enforcement of any ordinance or law regulating the construction, use or repair of any property, or requiring the demolition of undamaged parts of a building.',
      },
      {
        name: 'Wear Tear And Breakdown',
        text: 'Under Section I, we will not pay for loss caused by wear and tear, decay, deterioration, hidden or latent defect, mechanical breakdown, or insects, birds, rodents or other animals, except for resulting covered loss.',
      },
      {
        name: 'Expected Or Intended Injury',
        text: 'Under Section II, this insurance does not apply to bodily injury or property damage expected or intended from the standpoint of the Insured, except bodily injury resulting from the use of reasonable force to protect persons or property.',
      },
      {
        name: 'Professional Services',
        text: 'Under Section II, this insurance does not apply to bodily injury, property damage or personal and advertising injury due to the rendering of or failure to render any professional service.',
      },
      {
        name: 'Liquor Liability',
        text: 'Under Section II, this insurance does not apply to bodily injury or property damage for which any Insured may be held liable by reason of causing or contributing to the intoxication of any person, if you are in the business of manufacturing, distributing, selling or serving alcoholic beverages.',
      },
      {
        name: 'Auto Aircraft And Watercraft',
        text: 'Under Section II, this insurance does not apply to bodily injury or property damage arising out of the ownership, maintenance, use or entrustment to others of any aircraft, auto or watercraft owned, operated, rented or loaned to any Insured.',
      },
    ],
    conditions: [
      {
        name: 'Duties In The Event Of Loss Occurrence Or Claim',
        text: 'You must give us prompt notice of any loss, Occurrence, claim or suit, protect Covered Property from further damage, keep records of your expenses, cooperate with us in the investigation or settlement, and under Section I, send us a signed, sworn proof of loss within sixty days after our request.',
      },
      {
        name: 'Property Loss Settlement',
        text: 'Unless Actual Cash Value is shown in the Declarations, we will pay the cost to repair or replace Covered Property with material of like kind and quality without deduction for depreciation, but not until the property is actually repaired or replaced as soon as reasonably possible after the loss.',
      },
      {
        name: 'Other Insurance',
        text: 'Under Section I this insurance is excess over any more specific insurance covering the same property, and under Section II this insurance is primary except when other primary insurance applies, in which case we will share by equal contribution up to the applicable limits.',
      },
      {
        name: 'Premium Audit',
        text: 'The premium shown in the Declarations was computed based on rates and exposures in effect at inception; we may audit your books and records related to this policy during the policy period and within three years afterward, and the final premium will be adjusted accordingly.',
      },
      {
        name: 'Cancellation',
        text: 'The first Named Insured may cancel this policy by mailing or delivering advance written notice of cancellation; we may cancel by mailing notice at least ten days before the effective date for nonpayment of premium, or thirty days before for any other reason.',
      },
    ],
    endorsements: [
      {
        suffixNo: '1075',
        title: 'Equipment Breakdown Coverage',
        body: 'A. Coverage. We will pay for direct physical damage to Covered Property caused by a breakdown, meaning the sudden and accidental mechanical or electrical failure of covered equipment, or the bursting, cracking or rupture of a pressure vessel, at the described premises.\nB. Extensions. Business Income, extra expense and spoilage loss resulting from a covered breakdown are included, subject to the limits and waiting period shown in the Schedule.\nC. Exclusions. This endorsement does not cover breakdown caused by wear and tear alone, testing, or any condition covered by a manufacturer warranty or service contract.',
      },
      {
        suffixNo: '1188',
        title: 'Hired And Non-Owned Auto Liability',
        body: 'A. Coverage. Section II is extended to pay damages for bodily injury or property damage arising out of the use of a hired auto by you or your employees in the course of your business, or a non-owned auto used in your business by any person other than you.\nB. Excess Insurance. The coverage afforded by this endorsement is excess over any other collectible insurance available to the Insured.\nC. Limit. The most we will pay under this endorsement for any one accident is the Liability And Medical Expenses limit shown in the Declarations.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Described Premises And Occupancy',
      'Policy Period',
      'Building Limit Of Insurance',
      'Business Personal Property Limit',
      'Liability And Medical Expenses Limit',
      'Property Deductible',
      'Total Annual Premium',
    ],
  },
};
