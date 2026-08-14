// ── Personal-lines form chassis (SCRUM-229) ──
// Specimen-grade synthetic wording only — fictional, not filed carrier text.
import type { FormChassis } from './chassisTypes.js';

export const PERSONAL_CHASSIS: Record<string, FormChassis> = {
  HOMEOWNERS: {
    key: 'HOMEOWNERS',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured',
        text: 'Insured means you and residents of your household who are your relatives, or other persons under the age of twenty-one and in the care of any person named above.',
      },
      {
        term: 'Residence Premises',
        text: 'Residence Premises means the one-family dwelling, other structures and grounds, or that part of any other building where you reside, shown as the insured location in the Declarations.',
      },
      {
        term: 'Occurrence',
        text: 'Occurrence means an accident, including continuous or repeated exposure to substantially the same general harmful conditions, which results in bodily injury or property damage during the policy period.',
      },
      {
        term: 'Business',
        text: 'Business means any full-time, part-time or occasional activity engaged in for money or other compensation, other than an activity for which no Insured receives more than $2,000 in total compensation for the twelve months before the beginning of the policy period.',
      },
      {
        term: 'Actual Cash Value',
        text: 'Actual Cash Value means the amount it would cost to repair or replace covered property with material of like kind and quality, less allowance for physical deterioration and depreciation.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Coverage A - Dwelling',
        text: 'We insure against risk of direct physical loss to the dwelling on the Residence Premises shown in the Declarations, including structures attached to the dwelling and materials and supplies located on or next to the Residence Premises used to construct, alter or repair the dwelling.',
      },
      {
        name: 'Coverage B - Other Structures',
        text: 'We insure other structures on the Residence Premises set apart from the dwelling by clear space. This includes structures connected to the dwelling by only a fence, utility line or similar connection.',
      },
      {
        name: 'Coverage C - Personal Property',
        text: 'We insure personal property owned or used by an Insured while it is anywhere in the world. At your request, we will cover personal property owned by others while the property is on the part of the Residence Premises occupied by an Insured.',
      },
      {
        name: 'Coverage D - Loss Of Use',
        text: 'If a loss covered under this policy makes that part of the Residence Premises where you reside not fit to live in, we cover any necessary increase in living expenses incurred by you so that your household can maintain its normal standard of living.',
      },
      {
        name: 'Coverage E - Personal Liability',
        text: 'If a claim is made or a suit is brought against an Insured for damages because of bodily injury or property damage caused by an Occurrence to which this coverage applies, we will pay up to our limit of liability for the damages for which the Insured is legally liable, and provide a defense at our expense by counsel of our choice.',
      },
    ],
    limitsNote:
      'The limits of liability shown in the Declarations are the most we will pay for any one loss or Occurrence regardless of the number of Insureds, claims made or persons injured. The limit for Coverage B is ten percent of the Coverage A limit, and the limit for Coverage D is thirty percent of the Coverage A limit, unless otherwise stated in the Declarations. A deductible shown in the Declarations applies to each Section I loss.',
    exclusions: [
      {
        name: 'Ordinance Or Law',
        text: 'We do not insure for loss caused by the enforcement of any ordinance or law regulating the construction, repair or demolition of a building or other structure, unless specifically provided under this policy.',
      },
      {
        name: 'Earth Movement',
        text: 'We do not insure for loss caused by earthquake, land shock waves or tremors before, during or after a volcanic eruption, landslide, mudflow, or earth sinking, rising or shifting.',
      },
      {
        name: 'Water Damage',
        text: 'We do not insure for loss caused by flood, surface water, waves, tidal water, or the overflow of a body of water, whether or not driven by wind; water which backs up through sewers or drains; or water below the surface of the ground which exerts pressure on or seeps or leaks through a building, foundation or other structure.',
      },
      {
        name: 'Neglect',
        text: 'We do not insure for loss caused by your neglect to use all reasonable means to save and preserve property at and after the time of a loss.',
      },
      {
        name: 'Intentional Loss',
        text: 'We do not insure for any loss arising out of any act committed by or at the direction of an Insured with the intent to cause a loss.',
      },
      {
        name: 'Business Liability',
        text: 'Coverage E does not apply to bodily injury or property damage arising out of or in connection with a Business conducted from the Residence Premises or engaged in by an Insured, whether or not the Business is owned or operated by an Insured.',
      },
      {
        name: 'Motor Vehicle Liability',
        text: 'Coverage E does not apply to bodily injury or property damage arising out of the ownership, maintenance, occupancy, operation, use, loading or unloading of motor vehicles or watercraft, subject to the exceptions stated in this Section.',
      },
    ],
    conditions: [
      {
        name: 'Your Duties After Loss',
        text: 'In case of a loss to covered property, you must give prompt notice to us or our agent, protect the property from further damage, prepare an inventory of damaged personal property, and as often as we reasonably require, show the damaged property and submit to examination under oath. Within sixty days after our request, you must submit to us a signed, sworn proof of loss.',
      },
      {
        name: 'Loss Settlement',
        text: 'Personal property and structures that are not buildings are settled at Actual Cash Value at the time of loss, but not more than the amount required to repair or replace. Buildings under Coverage A or B are settled at replacement cost without deduction for depreciation, provided the amount of insurance on the damaged building is eighty percent or more of its full replacement cost immediately before the loss.',
      },
      {
        name: 'Appraisal',
        text: 'If you and we fail to agree on the amount of loss, either may demand an appraisal of the loss. Each party will choose a competent appraiser within twenty days after receiving a written request from the other, and the two appraisers will choose an umpire; a written agreement signed by any two of these three will set the amount of loss.',
      },
      {
        name: 'Suit Against Us',
        text: 'No action can be brought against us unless there has been full compliance with all of the terms under Section I of this policy and the action is started within two years after the date of loss.',
      },
      {
        name: 'Cancellation',
        text: 'You may cancel this policy at any time by returning it to us or by letting us know in writing of the date cancellation is to take effect. We may cancel by mailing you notice at least ten days before the date cancellation takes effect if for nonpayment of premium, or thirty days in all other cases.',
      },
    ],
    endorsements: [
      {
        suffixNo: '1544',
        title: 'Water Backup And Sump Discharge Or Overflow',
        body: 'A. Coverage. We insure, up to the limit shown in the Schedule, for direct physical loss to property covered under Section I caused by water which backs up through sewers or drains, or overflows or is discharged from a sump, sump pump or related equipment, even if such overflow or discharge results from mechanical breakdown of that equipment.\nB. Deductible. The deductible shown in the Schedule applies to each occurrence of loss covered by this endorsement and applies in place of any other deductible stated in the Declarations.\nC. Exclusions Applicable To This Endorsement. This coverage does not apply to loss caused by flood or surface water, or to loss resulting from the failure of any Insured to perform routine maintenance on any sump, sump pump, drain or sewer line.',
      },
      {
        suffixNo: '1620',
        title: 'Scheduled Personal Property',
        body: 'A. Coverage. We insure the classes of personal property described in the Schedule against risk of direct physical loss, up to the amount of insurance shown for each scheduled item. This coverage is worldwide.\nB. Newly Acquired Property. We cover property of a scheduled class newly acquired during the policy period for the lesser of twenty-five percent of the amount of insurance for that class or $10,000, provided you report the property to us within thirty days of acquisition and pay any additional premium.\nC. Loss Settlement. Scheduled items are settled at the least of the amount of insurance shown for the item, the cost to repair or replace with property of like kind and quality, or the appraised value stated in the Schedule.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Residence Premises Location',
      'Policy Period',
      'Coverage A - Dwelling Limit',
      'Coverage C - Personal Property Limit',
      'Coverage E - Personal Liability Limit',
      'Section I Deductible',
      'Total Policy Premium',
    ],
  },
  DWELLING_SPECIALTY: {
    key: 'DWELLING_SPECIALTY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Insured',
        text: 'Insured means the person or persons named in the Declarations and, while residents of the same household, the spouse and relatives of that person.',
      },
      {
        term: 'Described Location',
        text: 'Described Location means the dwelling unit, condominium unit, rented residence, mobile or manufactured home, or seasonal residence shown in the Declarations, including grounds and structures at that address used by an Insured for residential purposes.',
      },
      {
        term: 'Unit Improvements',
        text: 'Unit Improvements means the alterations, appliances, fixtures and improvements which are part of a condominium or cooperative unit and are the insurance responsibility of the unit owner under the governing association agreement.',
      },
      {
        term: 'Valuable Articles',
        text: 'Valuable Articles means jewelry, furs, fine art, silverware, cameras, musical instruments, stamp and coin collections, and other classes of property specifically described in a schedule to this policy.',
      },
      {
        term: 'Ground Movement Event',
        text: 'Ground Movement Event means a single earthquake shock or a series of earthquake shocks occurring within a period of one hundred sixty-eight hours, or a flood event as defined by the applicable flood coverage part when that part is shown in the Declarations.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Coverage A - Dwelling Or Unit',
        text: 'We insure against direct physical loss to the dwelling or Unit Improvements at the Described Location, according to the coverage form shown in the Declarations for that location. For a mobile or manufactured home, this includes attached structures, utility connections and skirting.',
      },
      {
        name: 'Coverage C - Personal Property',
        text: 'We insure personal property owned or used by an Insured at the Described Location, and elsewhere in the world up to ten percent of the Coverage C limit. Property of guests and domestic employees may be covered at your request while at the Described Location.',
      },
      {
        name: 'Loss Assessment',
        text: 'We will pay up to the limit shown in the Declarations for your share of a loss assessment charged against you by a residential association of property owners, when the assessment is made as a result of direct loss to property collectively owned by all members and caused by a peril insured against under this policy.',
      },
      {
        name: 'Fair Rental Value',
        text: 'If a loss covered under this policy makes that part of the Described Location rented to others or held for rental not fit to live in, we cover the fair rental value of that part, less any expenses that do not continue while it is not fit to live in.',
      },
    ],
    limitsNote:
      'The limit of liability for each coverage is shown in the Declarations for each Described Location and is the most we will pay for any one loss at that location. Where earthquake or flood coverage is shown, a separate percentage deductible stated in the Declarations applies to each Ground Movement Event in place of any other deductible, and scheduled Valuable Articles are subject to the per-item amounts shown in the schedule rather than any special limits elsewhere in this policy.',
    exclusions: [
      {
        name: 'Ordinance Or Law',
        text: 'We do not insure for loss caused by the enforcement of any ordinance or law regulating the construction, repair or demolition of a building or other structure, unless coverage is specifically provided under this policy.',
      },
      {
        name: 'Earth Movement',
        text: 'Except as provided when earthquake coverage is shown in the Declarations, we do not insure for loss caused by earthquake, landslide, mudflow, or earth sinking, rising or shifting.',
      },
      {
        name: 'Water Damage',
        text: 'Except as provided when flood coverage is shown in the Declarations, we do not insure for loss caused by flood, surface water, waves, tidal water, or water which backs up through sewers or drains.',
      },
      {
        name: 'Association Property',
        text: 'We do not insure property that the governing association agreement makes the insurance responsibility of the association, except as provided under Loss Assessment.',
      },
      {
        name: 'Vacancy',
        text: 'We do not insure for loss by vandalism, malicious mischief, theft, or freezing of plumbing occurring while the dwelling or unit has been vacant for more than sixty consecutive days immediately before the loss; a seasonal residence regularly occupied by an Insured is not considered vacant solely because of seasonal absence.',
      },
      {
        name: 'Wear And Tear',
        text: 'We do not insure for loss caused by wear and tear, marring, deterioration, inherent vice, latent defect, mechanical breakdown, rust, corrosion, or birds, vermin, rodents, insects or domestic animals.',
      },
      {
        name: 'Business Property',
        text: 'We do not insure personal property used at any time or in any manner for any business purpose, other than landlord furnishings expressly covered at a Described Location rented to others.',
      },
    ],
    conditions: [
      {
        name: 'Your Duties After Loss',
        text: 'In case of a loss, you must give prompt notice to us or our agent, protect the property from further damage, keep an accurate record of repair expenses, and submit a signed, sworn proof of loss within sixty days after our request.',
      },
      {
        name: 'Loss Settlement',
        text: 'Unless otherwise stated in the Declarations, covered property losses are settled at Actual Cash Value at the time of loss but not more than the amount required to repair or replace. Scheduled Valuable Articles are settled at the least of the scheduled amount, the cost to repair or replace, or the appraised value.',
      },
      {
        name: 'Other Insurance',
        text: 'If a loss covered by this policy is also covered by insurance carried by a residential association, this insurance is excess over the amount recoverable under the association insurance.',
      },
      {
        name: 'Appraisal',
        text: 'If you and we fail to agree on the amount of loss, either may demand an appraisal. Each party will choose a competent appraiser, the appraisers will choose an umpire, and a written agreement signed by any two of the three will set the amount of loss.',
      },
      {
        name: 'Assignment',
        text: 'Assignment of this policy is not valid unless we give our written consent.',
      },
    ],
    endorsements: [
      {
        suffixNo: '2210',
        title: 'Landlord Furnishings And Rental Unit Provisions',
        body: 'A. Landlord Furnishings. We insure appliances, carpeting and other household furnishings owned by you, in each apartment or unit at the Described Location regularly rented or held for rental to others, up to the limit shown in the Schedule for any one loss in any one apartment or unit.\nB. Tenant Damage. We insure sudden and accidental direct physical damage to the dwelling caused by a tenant, other than damage caused by wear and tear or by any illegal activity of which you had knowledge.\nC. Deductible. The deductible stated in the Declarations applies separately to each apartment or unit sustaining loss.',
      },
      {
        suffixNo: '2385',
        title: 'Seasonal And Unoccupied Residence Provisions',
        body: 'A. Occupancy Requirement. Coverage at the Described Location applies while the residence is occupied on a seasonal basis, provided the residence is inspected by you or a person you designate at least once every thirty days during any period of unoccupancy.\nB. Heating And Water Systems. We do not pay for loss caused by freezing of a plumbing, heating or air conditioning system unless you have used reasonable care to maintain heat in the building, or have shut off the water supply and drained all systems and appliances of water.\nC. Theft Limitation. During any period of unoccupancy exceeding thirty consecutive days, theft coverage is limited to loss by forcible entry of which there is visible evidence.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Described Location And Occupancy Type',
      'Coverage Form Applicable',
      'Policy Period',
      'Coverage A - Dwelling Or Unit Limit',
      'Coverage C - Personal Property Limit',
      'Earthquake Or Flood Percentage Deductible',
      'Total Policy Premium',
    ],
  },
  PERSONAL_AUTO: {
    key: 'PERSONAL_AUTO',
    documentKind: 'policy',
    definitions: [
      {
        term: 'You And Your',
        text: 'You and Your refer to the named insured shown in the Declarations and the spouse if a resident of the same household.',
      },
      {
        term: 'Bodily Injury',
        text: 'Bodily Injury means bodily harm, sickness or disease, including death that results.',
      },
      {
        term: 'Covered Auto',
        text: 'Covered Auto means any vehicle shown in the Declarations, a newly acquired auto, any trailer you own, or any auto or trailer you do not own while used as a temporary substitute for any other vehicle described in this definition which is out of normal use because of breakdown, repair, servicing, loss or destruction.',
      },
      {
        term: 'Family Member',
        text: 'Family Member means a person related to you by blood, marriage or adoption who is a resident of your household, including a ward or foster child.',
      },
      { term: 'Occupying', text: 'Occupying means in, upon, getting in, on, out or off.' },
      {
        term: 'Property Damage',
        text: 'Property Damage means physical injury to, destruction of or loss of use of tangible property.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Part A - Liability Coverage',
        text: 'We will pay damages for Bodily Injury or Property Damage for which any insured becomes legally responsible because of an auto accident. We will settle or defend, as we consider appropriate, any claim or suit asking for these damages, and in addition to our limit of liability we will pay all defense costs we incur.',
      },
      {
        name: 'Part B - Medical Payments Coverage',
        text: 'We will pay reasonable expenses incurred for necessary medical and funeral services because of Bodily Injury caused by accident and sustained by an insured. We will pay only those expenses incurred for services rendered within three years from the date of the accident.',
      },
      {
        name: 'Part C - Uninsured Motorists Coverage',
        text: 'We will pay compensatory damages which an insured is legally entitled to recover from the owner or operator of an uninsured motor vehicle because of Bodily Injury sustained by an insured and caused by an accident arising out of the ownership, maintenance or use of the uninsured motor vehicle.',
      },
      {
        name: 'Part D - Coverage For Damage To Your Auto',
        text: 'We will pay for direct and accidental loss to your Covered Auto or any non-owned auto, including its equipment, minus any applicable deductible shown in the Declarations. If loss to more than one of your Covered Autos results from the same collision, only the highest applicable deductible will apply.',
      },
    ],
    limitsNote:
      'The limit of liability shown in the Declarations for each person for Bodily Injury Liability is our maximum limit of liability for all damages arising out of Bodily Injury sustained by any one person in any one auto accident. Subject to this limit for each person, the limit shown for each accident is our maximum limit for all damages arising out of Bodily Injury resulting from any one auto accident, and the limit shown for Property Damage is our maximum limit for all Property Damage resulting from any one auto accident. This is the most we will pay regardless of the number of insureds, claims made, vehicles or premiums shown in the Declarations, or vehicles involved in the accident.',
    exclusions: [
      {
        name: 'Intentional Injury',
        text: 'We do not provide Liability Coverage for any insured who intentionally causes Bodily Injury or Property Damage.',
      },
      {
        name: 'Owned Property',
        text: 'We do not provide Liability Coverage for Property Damage to property owned or being transported by the insured, or to property rented to, used by, or in the care of the insured other than a residence or private garage.',
      },
      {
        name: 'Public Or Livery Conveyance',
        text: 'We do not provide coverage for liability arising out of the ownership or operation of a vehicle while it is being used as a public or livery conveyance, or while the insured is logged on to a transportation network platform as a driver. This exclusion does not apply to a share-the-expense car pool.',
      },
      {
        name: 'Auto Business',
        text: 'We do not provide coverage while any insured is employed or otherwise engaged in the business of selling, repairing, servicing, storing or parking vehicles designed for use mainly on public highways.',
      },
      {
        name: 'No Reasonable Belief',
        text: 'We do not provide coverage for any insured using a vehicle without a reasonable belief that the insured is entitled to do so.',
      },
      {
        name: 'Wear And Tear',
        text: 'Under Part D, we will not pay for damage due and confined to wear and tear, freezing, mechanical or electrical breakdown or failure, or road damage to tires. This exclusion does not apply if the damage results from the total theft of your Covered Auto.',
      },
      {
        name: 'War And Nuclear',
        text: 'We will not pay for loss due to or as a consequence of radioactive contamination, discharge of any nuclear weapon, war, insurrection, rebellion or revolution.',
      },
    ],
    conditions: [
      {
        name: 'Duties After An Accident Or Loss',
        text: 'We must be notified promptly of how, when and where the accident or loss happened, including the names and addresses of any injured persons and witnesses. A person seeking coverage must cooperate with us in the investigation, settlement or defense of any claim or suit, and promptly send us copies of any notices or legal papers received in connection with the accident or loss.',
      },
      {
        name: 'Policy Period And Territory',
        text: 'This policy applies only to accidents and losses which occur during the policy period as shown in the Declarations and within the policy territory, which is the United States of America, its territories or possessions, Puerto Rico or Canada, or while your Covered Auto is being transported between their ports.',
      },
      {
        name: 'Termination',
        text: 'You may cancel this policy by returning it to us or by giving us advance written notice of the date cancellation is to take effect. We may cancel by mailing at least ten days notice if cancellation is for nonpayment of premium, or twenty days notice in all other cases.',
      },
      {
        name: 'Two Or More Auto Policies',
        text: 'If this policy and any other auto insurance policy issued to you by us apply to the same accident, the maximum limit of our liability under all the policies shall not exceed the highest applicable limit of liability under any one policy.',
      },
      {
        name: 'Legal Action Against Us',
        text: 'No legal action may be brought against us until there has been full compliance with all the terms of this policy, and under Part A, until we agree in writing that the insured has an obligation to pay or until the amount of that obligation has been finally determined by judgment after trial.',
      },
    ],
    endorsements: [
      {
        suffixNo: '2114',
        title: 'Transportation Network Driving Exclusion',
        body: 'A. Exclusion. We do not provide any coverage under this policy for Bodily Injury, Property Damage or loss arising out of the ownership, maintenance or use of any vehicle while the driver is logged on to a transportation network platform as a driver or is engaged in a prearranged ride.\nB. Definition. Transportation network platform means an online-enabled application or digital network used to connect passengers with drivers for the purpose of providing prearranged transportation services for compensation.\nC. Exception. This exclusion does not apply to a share-the-expense car pool or to coverage a transportation network endorsement to this policy expressly provides.',
      },
      {
        suffixNo: '2430',
        title: 'Extended Non-Owned Coverage For Named Individual',
        body: 'A. Coverage Extension. Liability Coverage and Medical Payments Coverage are extended to apply to a vehicle furnished or available for the regular use of the individual named in the Schedule, other than a vehicle owned by that individual.\nB. Excess Insurance. The coverage afforded by this endorsement is excess over any other collectible insurance available to the named individual.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Described Vehicles With Identification Numbers',
      'Bodily Injury Liability Limits',
      'Property Damage Liability Limit',
      'Collision And Other Than Collision Deductibles',
      'Listed Drivers',
      'Total Policy Premium',
    ],
  },
  SPECIALTY_VEHICLE: {
    key: 'SPECIALTY_VEHICLE',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Covered Craft Or Vehicle',
        text: 'Covered Craft Or Vehicle means the watercraft, motorcycle, recreational vehicle, all-terrain vehicle or classic auto described in the Declarations, including permanently attached equipment and, for watercraft, the motor and trailer described in the Declarations.',
      },
      {
        term: 'Agreed Value',
        text: 'Agreed Value means the amount of insurance shown in the Declarations for a Covered Craft Or Vehicle insured on an agreed value basis, established between you and us at issue based on appraisal or documented valuation.',
      },
      {
        term: 'Lay-Up Period',
        text: 'Lay-Up Period means the period shown in the Declarations during which the Covered Craft Or Vehicle is out of active service and stored, and during which navigation or road use is not covered.',
      },
      {
        term: 'Navigation Territory',
        text: 'Navigation Territory means the waters described in the Declarations within which coverage for a watercraft applies.',
      },
      {
        term: 'Passenger',
        text: 'Passenger means any person in, on, boarding or alighting from the Covered Craft Or Vehicle with the permission of an Insured.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Physical Damage Coverage',
        text: 'We will pay for direct and accidental loss to the Covered Craft Or Vehicle, minus any applicable deductible shown in the Declarations. For a craft or vehicle insured on an agreed value basis, a covered total loss is settled at the Agreed Value without deduction for depreciation.',
      },
      {
        name: 'Liability Coverage',
        text: 'We will pay damages for bodily injury or property damage for which any Insured becomes legally responsible because of an accident arising out of the ownership, maintenance or use of the Covered Craft Or Vehicle. We will settle or defend, as we consider appropriate, any claim or suit asking for these damages.',
      },
      {
        name: 'Medical Payments Coverage',
        text: 'We will pay reasonable expenses incurred for necessary medical and funeral services because of bodily injury caused by accident and sustained by an Insured or any Passenger while occupying the Covered Craft Or Vehicle.',
      },
      {
        name: 'Emergency Assistance And Towing',
        text: 'We will pay up to the limit shown in the Declarations for reasonable costs you incur for towing to the nearest place of repair, emergency labor at the place of disablement, and, for watercraft, salvage assistance required to protect the craft from further loss.',
      },
    ],
    limitsNote:
      'The limit of liability shown in the Declarations for each coverage is the most we will pay for any one accident or loss regardless of the number of Insureds, claims made or craft or vehicles involved. Physical damage recovery will not exceed the Agreed Value for scheduled items insured on that basis, or Actual Cash Value for all other items, and the deductible shown in the Declarations applies to each separate loss.',
    exclusions: [
      {
        name: 'Racing And Speed Contests',
        text: 'We do not cover loss or liability arising out of participation in, or practice or preparation for, any prearranged or organized race, speed contest or timed competition. For sailboats, this exclusion does not apply to sailboat racing unless the Declarations state otherwise.',
      },
      {
        name: 'Business Use',
        text: 'We do not cover loss or liability arising while the Covered Craft Or Vehicle is used to carry persons or property for a fee, is rented or chartered to others, or is used for any other business purpose not declared to us.',
      },
      {
        name: 'Outside Territory Or Lay-Up',
        text: 'We do not cover loss occurring outside the Navigation Territory, or loss occurring while a watercraft is navigated or a vehicle is operated during the Lay-Up Period stated in the Declarations.',
      },
      {
        name: 'Wear And Deterioration',
        text: 'We do not cover loss caused by wear and tear, gradual deterioration, osmosis or blistering, marring, denting or scratching, corrosion, mold, insects, animals or marine life, or mechanical or electrical breakdown not caused by an insured peril.',
      },
      {
        name: 'Operators Not Declared',
        text: 'We do not cover loss or liability occurring while the Covered Craft Or Vehicle is operated by a person not named in the Declarations as an operator when the Declarations state that coverage is limited to named operators.',
      },
      {
        name: 'Classic Use Restriction',
        text: 'For a classic auto insured on an agreed value basis, we do not cover loss or liability arising while the auto is used for daily commuting or other regular transportation use, unless such use is declared in the Declarations.',
      },
      {
        name: 'Intentional Loss',
        text: 'We do not cover any loss or damage caused intentionally by or at the direction of an Insured.',
      },
    ],
    conditions: [
      {
        name: 'Duties After Loss',
        text: 'You must give us prompt notice of how, when and where the loss happened, protect the Covered Craft Or Vehicle from further loss, and permit us to inspect it before repair or disposal. We will pay reasonable expenses incurred in protecting the property from further loss.',
      },
      {
        name: 'Loss Settlement',
        text: 'A covered total loss to a scheduled item insured on an agreed value basis is settled at the Agreed Value. Partial losses are settled at the reasonable cost to repair with parts of like kind and quality, and for classic autos, with original or reproduction parts where reasonably available.',
      },
      {
        name: 'Layup And Territory Warranty',
        text: 'You warrant that the Covered Craft Or Vehicle will be laid up and out of commission during the Lay-Up Period, and that a watercraft will be operated only within the Navigation Territory, except while being moved by a professional carrier.',
      },
      {
        name: 'Other Insurance',
        text: 'If other valid and collectible insurance applies to a loss covered by this policy, we will pay only our share, which is the proportion that our limit of liability bears to the total of all applicable limits.',
      },
      {
        name: 'Cancellation',
        text: 'You may cancel this policy at any time by giving us written notice. We may cancel by mailing at least ten days notice for nonpayment of premium, or thirty days notice in all other cases.',
      },
    ],
    endorsements: [
      {
        suffixNo: '3160',
        title: 'Trailer And Transport Physical Damage',
        body: 'A. Coverage. We will pay for direct and accidental loss to the trailer described in the Schedule, and to the Covered Craft Or Vehicle while it is loaded on, carried by, or being loaded onto or unloaded from that trailer.\nB. Limit. The most we will pay for loss to the trailer is the amount shown in the Schedule for the trailer, and the deductible stated in the Declarations applies to each loss under this endorsement.\nC. Exclusion. We do not pay for loss caused by improper loading or securing performed by anyone other than a professional carrier.',
      },
      {
        suffixNo: '3245',
        title: 'Roadside And On-Water Recovery Expansion',
        body: 'A. Expanded Assistance. The limit for Emergency Assistance And Towing is increased to the amount shown in the Schedule, and coverage is extended to include delivery of fuel, oil or battery service at the place of disablement, the cost of the delivered items excepted.\nB. On-Water Recovery. For watercraft, we will also pay reasonable emergency salvage and ungrounding charges necessarily incurred to prevent imminent further loss to the craft.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Described Craft Or Vehicle With Serial Or Hull Number',
      'Valuation Basis - Agreed Value Or Actual Cash Value',
      'Policy Period',
      'Navigation Territory Or Use Restriction',
      'Liability Limit Each Accident',
      'Physical Damage Deductible',
      'Total Policy Premium',
    ],
  },
  PERSONAL_CYBER: {
    key: 'PERSONAL_CYBER',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Cyber Incident',
        text: 'Cyber Incident means unauthorized access to or use of a connected home device or personal computing device owned or leased by an Insured, or a denial-of-service attack or malware infection affecting such a device.',
      },
      {
        term: 'Identity Fraud',
        text: 'Identity Fraud means the act of knowingly transferring or using, without lawful authority, a means of identification of an Insured with the intent to commit any unlawful activity that constitutes a violation of law.',
      },
      {
        term: 'Cyber Extortion Threat',
        text: 'Cyber Extortion Threat means a credible threat communicated to an Insured to damage, disable, or deny access to a personal computing device or the electronic data on it, unless money is paid.',
      },
      {
        term: 'Electronic Data',
        text: 'Electronic Data means digital information, including photographs, documents and media files, stored on a personal computing device or in a consumer cloud account of an Insured, other than data used in any business.',
      },
      {
        term: 'Cyberbullying',
        text: 'Cyberbullying means harassment or intimidation of an Insured committed through electronic communication, resulting in wrongful termination, false arrest, debilitating shock, or documented mental anguish requiring treatment.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Cyber Attack Response',
        text: 'We will pay the reasonable and necessary costs an Insured incurs to remove malware from, restore, and reconfigure a personal computing device or connected home device following a Cyber Incident first discovered during the policy period.',
      },
      {
        name: 'Identity Fraud Expense Reimbursement',
        text: 'We will reimburse an Insured for expenses incurred as the direct result of Identity Fraud first discovered during the policy period, including notarization and certified mailing costs, lost wages for time taken to correct records, and reasonable attorney fees incurred with our prior consent.',
      },
      {
        name: 'Cyber Extortion',
        text: 'If an Insured receives a Cyber Extortion Threat first made during the policy period, we will pay the reasonable costs of a qualified consultant retained with our prior consent to respond to the threat, and amounts paid with our prior written consent where payment is legally permissible.',
      },
      {
        name: 'Data Restoration',
        text: 'We will pay the reasonable and necessary costs to restore Electronic Data lost or corrupted as the direct result of a Cyber Incident, from backup or from original sources where available.',
      },
      {
        name: 'Cyberbullying Expense',
        text: 'We will reimburse an Insured for counseling, lost wages and temporary relocation expenses incurred as the direct result of Cyberbullying first occurring during the policy period.',
      },
    ],
    limitsNote:
      'The aggregate limit shown in the Declarations is the most we will pay for all loss under all insuring agreements combined arising during the policy period, and each insuring agreement is subject to the sublimit shown for it in the Declarations. A deductible shown in the Declarations applies to each incident, and all loss arising from the same, continuous or related Cyber Incident is treated as one incident first discovered when the earliest part of it was discovered.',
    exclusions: [
      {
        name: 'Business Activities',
        text: 'We do not cover loss arising out of any business, profession or occupation of an Insured, including devices or data used in any business.',
      },
      {
        name: 'Prior Known Incidents',
        text: 'We do not cover loss arising from a Cyber Incident, Identity Fraud or threat that an Insured first discovered or reasonably should have discovered before the beginning of the policy period.',
      },
      {
        name: 'Dishonest Acts Of An Insured',
        text: 'We do not cover loss caused by the dishonest, criminal or fraudulent conduct of any Insured, or by any person acting in collusion with an Insured.',
      },
      {
        name: 'Physical Damage',
        text: 'We do not cover physical injury to persons, or loss or damage to tangible property other than the cost to restore or reconfigure a covered device as expressly provided.',
      },
      {
        name: 'Cryptocurrency And Investment Loss',
        text: 'We do not cover the loss of value or theft of cryptocurrency, non-fungible tokens or other digital assets held for investment, or any trading or investment loss.',
      },
      {
        name: 'Utility And Infrastructure Failure',
        text: 'We do not cover loss caused by the failure or outage of any power, telecommunications or internet service provider, satellite, or other infrastructure not owned or controlled by an Insured.',
      },
    ],
    conditions: [
      {
        name: 'Duties After Discovery',
        text: 'Upon discovery of a Cyber Incident, Identity Fraud or Cyber Extortion Threat, you must notify us as soon as practicable, take all reasonable steps to protect devices and Electronic Data from further loss, and notify law enforcement where the loss involves a violation of law.',
      },
      {
        name: 'Consent To Incur Costs',
        text: 'Except for emergency measures reasonably required to limit loss, costs and consultant fees are covered only if incurred with our prior consent, which we will not unreasonably withhold.',
      },
      {
        name: 'Proof Of Loss',
        text: 'You must submit a signed, sworn proof of loss within sixty days after our request, including receipts, account statements and reports reasonably necessary to establish the amount of loss.',
      },
      {
        name: 'Recoveries',
        text: 'If you recover any amount for a loss we have paid, you must return it to us, less your actual costs of recovery, up to the amount we paid.',
      },
      {
        name: 'Other Insurance',
        text: 'This insurance is excess over any other valid and collectible insurance or service agreement available to an Insured for the same loss.',
      },
    ],
    endorsements: [
      {
        suffixNo: '4410',
        title: 'Connected Home Systems Extension',
        body: 'A. Extension. The definition of connected home device is extended to include smart thermostats, connected security and monitoring systems, connected appliances, and home automation controllers installed at the residence premises shown in the Declarations.\nB. System Restoration. Following a covered Cyber Incident, we will also pay the reasonable cost of a qualified technician to restore connected home systems to their pre-incident configuration, up to the sublimit shown in the Schedule.\nC. Exclusion. This extension does not apply to any device that monitors or controls life-safety medical equipment.',
      },
      {
        suffixNo: '4525',
        title: 'Online Fraud And Deceptive Transfer Reimbursement',
        body: 'A. Coverage. We will reimburse an Insured for the direct financial loss of funds transferred from a personal account as the result of a deceptive instruction from a third party who misrepresented their identity, first discovered during the policy period, up to the sublimit shown in the Schedule.\nB. Conditions. Reimbursement applies only if the transfer was not recoverable from the financial institution, and you report the fraud to the institution and law enforcement within seventy-two hours of discovery.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Aggregate Limit Of Insurance',
      'Insuring Agreement Sublimits Schedule',
      'Deductible Each Incident',
      'Residence Premises For Connected Home Coverage',
      'Total Policy Premium',
    ],
  },
  PERSONAL_UMBRELLA: {
    key: 'PERSONAL_UMBRELLA',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Retained Limit',
        text: 'Retained Limit means the total limits of the underlying insurance listed in the Schedule Of Underlying Insurance, or the self-insured retention shown in the Declarations for an Occurrence not covered by underlying insurance.',
      },
      {
        term: 'Underlying Insurance',
        text: 'Underlying Insurance means the policies of insurance listed in the Schedule Of Underlying Insurance, and any replacements of them, providing the primary limits the Declarations require you to maintain.',
      },
      {
        term: 'Personal Injury',
        text: 'Personal Injury means injury arising out of false arrest, detention or imprisonment; malicious prosecution; wrongful eviction from or wrongful entry into a premises that a person occupies; or oral or written publication of material that slanders or libels a person or violates a person’s right of privacy.',
      },
      {
        term: 'Occurrence',
        text: 'Occurrence means an accident, including continuous or repeated exposure to substantially the same general harmful conditions, which results during the policy period in bodily injury, property damage or Personal Injury.',
      },
      {
        term: 'Loss',
        text: 'Loss means the sums an Insured becomes legally obligated to pay as damages because of bodily injury, property damage or Personal Injury covered by this policy, including prejudgment interest awarded against the Insured.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Excess Liability Coverage',
        text: 'We will pay on behalf of an Insured the Loss in excess of the Retained Limit, up to our limit of liability, because of bodily injury, property damage or Personal Injury caused by an Occurrence to which this policy applies.',
      },
      {
        name: 'Defense Coverage',
        text: 'When the Underlying Insurance does not apply to an Occurrence covered by this policy, or its limits have been exhausted by payment of judgments or settlements, we will defend any suit against an Insured seeking damages covered by this policy, at our expense by counsel of our choice, even if the suit is groundless, false or fraudulent.',
      },
    ],
    limitsNote:
      'Our limit of liability shown in the Declarations is the most we will pay for all Loss arising out of any one Occurrence, regardless of the number of Insureds, claims made or persons injured, and applies in excess of the Retained Limit. If the aggregate limit of any Underlying Insurance has been reduced or exhausted by payments, this policy applies in excess of the reduced or exhausted limit, but we are never liable for the amount of any reduction of the Retained Limit caused by your failure to maintain the required Underlying Insurance.',
    exclusions: [
      {
        name: 'Expected Or Intended Injury',
        text: 'We do not cover bodily injury, property damage or Personal Injury which is expected or intended by the Insured, even if the resulting harm is different or greater than expected.',
      },
      {
        name: 'Business Pursuits',
        text: 'We do not cover liability arising out of a business pursuit of an Insured, other than the occasional rental of the Insured’s residence or activities for which coverage is provided by the Underlying Insurance.',
      },
      {
        name: 'Professional Services',
        text: 'We do not cover liability arising out of the rendering of or failure to render professional services.',
      },
      {
        name: 'Damage To Owned Property',
        text: 'We do not cover property damage to property owned by an Insured.',
      },
      {
        name: 'Workers Compensation Obligations',
        text: 'We do not cover any obligation for which an Insured or an Insured’s insurer may be held liable under a workers’ compensation, disability benefits or unemployment compensation law.',
      },
      {
        name: 'Aircraft',
        text: 'We do not cover liability arising out of the ownership, maintenance, use or entrustment to others of any aircraft, other than model or hobby aircraft not used to carry persons or cargo.',
      },
      {
        name: 'Uninsured Watercraft And Recreational Vehicles',
        text: 'We do not cover liability arising out of any watercraft, recreational vehicle or motorized land vehicle owned by an Insured unless Underlying Insurance with the required limit is in force for it at the time of the Occurrence.',
      },
    ],
    conditions: [
      {
        name: 'Maintenance Of Underlying Insurance',
        text: 'You must maintain the Underlying Insurance at the limits stated in the Schedule Of Underlying Insurance in full force during the policy period, and notify us promptly if any Underlying Insurance is cancelled, not renewed or materially changed.',
      },
      {
        name: 'Duties After An Occurrence',
        text: 'You must give us written notice of an Occurrence reasonably likely to involve this policy as soon as practicable, cooperate with us in the investigation, settlement or defense of any claim or suit, and forward promptly every demand, notice or summons received.',
      },
      {
        name: 'Appeals',
        text: 'If the Insured or the underlying insurer elects not to appeal a judgment which exceeds the Retained Limit, we may do so at our expense, but our liability will not exceed our limit of liability plus the cost and interest incidental to the appeal.',
      },
      {
        name: 'Other Insurance',
        text: 'This insurance is excess over any other valid and collectible insurance available to an Insured, whether primary, excess or contingent, other than insurance written specifically to apply in excess of this policy.',
      },
      {
        name: 'Subrogation',
        text: 'If we make a payment under this policy, we are entitled to all the rights of recovery of the Insured against any person or organization, and the Insured must do everything necessary to secure and preserve those rights.',
      },
    ],
    endorsements: [
      {
        suffixNo: '5120',
        title: 'Uninsured And Underinsured Motorists Excess Coverage',
        body: 'A. Coverage. We will pay compensatory damages, in excess of the Retained Limit for this coverage shown in the Schedule, which an Insured is legally entitled to recover from the owner or operator of an uninsured or underinsured motor vehicle because of bodily injury sustained by an Insured.\nB. Limit. The limit shown in the Schedule for this endorsement is the most we will pay for all damages arising out of any one accident, and applies in place of the policy limit with respect to this coverage.\nC. Arbitration. If we and the Insured do not agree on the right to recover damages or their amount, either party may make a written demand for arbitration before a single arbitrator agreed to by both parties.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Policy Period',
      'Limit Of Liability Each Occurrence',
      'Self-Insured Retention',
      'Schedule Of Underlying Insurance And Required Limits',
      'Listed Vehicles Watercraft And Properties',
      'Total Policy Premium',
    ],
  },
  PET_AFFINITY: {
    key: 'PET_AFFINITY',
    documentKind: 'policy',
    definitions: [
      {
        term: 'Enrolled Pet',
        text: 'Enrolled Pet means the dog or cat identified in the Declarations by name, breed and date of birth, owned by or in the permanent care of the named insured.',
      },
      {
        term: 'Illness',
        text: 'Illness means a sickness, disease or medical condition of an Enrolled Pet, including any recurrence, that first manifests clinical signs after the waiting period stated in the Declarations.',
      },
      {
        term: 'Accident',
        text: 'Accident means a sudden, unforeseen and unintended event, independent of Illness, that causes physical injury to an Enrolled Pet.',
      },
      {
        term: 'Eligible Treatment',
        text: 'Eligible Treatment means medically necessary diagnosis, treatment, surgery, hospitalization and prescription medication provided to an Enrolled Pet by or under the supervision of a licensed veterinarian.',
      },
      {
        term: 'Covered Purchase',
        text: 'Covered Purchase means a consumer product or service purchased through the sponsoring program identified in the Declarations, for which protection benefits are shown in the Benefit Schedule.',
      },
      {
        term: 'Pre-Existing Condition',
        text: 'Pre-Existing Condition means an Illness or injury that first manifested clinical signs, or for which a veterinarian recommended evaluation or treatment, before the effective date of coverage or during the waiting period.',
      },
    ],
    insuringAgreements: [
      {
        name: 'Veterinary Accident And Illness Benefit',
        text: 'We will reimburse the reasonable cost of Eligible Treatment of an Enrolled Pet for an Accident or Illness occurring during the policy period, at the reimbursement percentage shown in the Declarations, after the deductible has been satisfied.',
      },
      {
        name: 'Purchase Protection Benefit',
        text: 'We will reimburse the named insured for the cost to repair or replace a Covered Purchase that is accidentally damaged or stolen within ninety days of purchase, up to the amount shown in the Benefit Schedule for any one Covered Purchase.',
      },
      {
        name: 'Extended Product Warranty Benefit',
        text: 'For a Covered Purchase carrying an original manufacturer warranty of twelve months or less, we will extend the warranty period by an additional period equal to the original term, covering the cost of repair or replacement on the same terms as the original warranty.',
      },
      {
        name: 'Lost Pet Advertising And Reward',
        text: 'If an Enrolled Pet is lost or stolen during the policy period, we will reimburse the reasonable cost of advertising and a reward paid for its recovery, up to the sublimit shown in the Declarations.',
      },
    ],
    limitsNote:
      'The annual benefit limit shown in the Declarations is the most we will reimburse for all Eligible Treatment of an Enrolled Pet in any one policy year, and each other benefit is subject to the per-item and aggregate amounts shown in the Benefit Schedule. The deductible shown in the Declarations applies once per policy year to veterinary benefits, and the reimbursement percentage applies to covered costs after the deductible.',
    exclusions: [
      {
        name: 'Pre-Existing Conditions',
        text: 'We do not reimburse costs for a Pre-Existing Condition of an Enrolled Pet, or for any condition first manifesting during a waiting period stated in the Declarations.',
      },
      {
        name: 'Elective And Routine Care',
        text: 'We do not reimburse costs for elective procedures, breeding, cosmetic procedures, or routine and preventive care including vaccination, parasite control and dental cleaning, unless a wellness benefit is shown in the Declarations.',
      },
      {
        name: 'Racing And Commercial Use',
        text: 'We do not reimburse costs for injury or Illness arising out of the use of an Enrolled Pet for organized racing, fighting, commercial breeding or commercial guarding.',
      },
      {
        name: 'Normal Wear - Purchase Benefits',
        text: 'Purchase Protection and Extended Product Warranty benefits do not apply to loss caused by normal wear and tear, inherent product defect recalls, cosmetic damage that does not affect function, or loss of a purchase left unattended in a place accessible to the public.',
      },
      {
        name: 'Motor Vehicles And Real Property',
        text: 'Purchase Protection and Extended Product Warranty benefits do not apply to motor vehicles, watercraft, real property, plants, animals, perishables or consumables.',
      },
      {
        name: 'Intentional Acts And Neglect',
        text: 'We do not reimburse costs arising from the intentional act, abuse or neglect of the named insured or any member of the named insured’s household.',
      },
    ],
    conditions: [
      {
        name: 'Claim Submission',
        text: 'A claim must be submitted within ninety days after treatment or loss, accompanied by itemized invoices and, for veterinary benefits, the treating veterinarian’s records sufficient to establish the diagnosis and treatment provided.',
      },
      {
        name: 'Veterinary Examination Records',
        text: 'You must authorize us to obtain the medical records of an Enrolled Pet from any treating veterinarian, and we may require an examination of the Enrolled Pet by a veterinarian we select, at our expense.',
      },
      {
        name: 'Continuity Of Enrollment',
        text: 'Coverage for an Illness that continues across policy years remains eligible only while enrollment of the Enrolled Pet continues without interruption; a break in enrollment makes previously covered conditions Pre-Existing Conditions upon re-enrollment.',
      },
      {
        name: 'Benefit Program Changes',
        text: 'Benefits provided through the sponsoring program apply only while the named insured remains a member in good standing of that program; we will give at least thirty days written notice of any change to the Benefit Schedule.',
      },
      {
        name: 'Other Insurance Or Warranty',
        text: 'Purchase Protection and Extended Product Warranty benefits are excess over any other applicable insurance, service contract or manufacturer warranty.',
      },
    ],
    endorsements: [
      {
        suffixNo: '6110',
        title: 'Wellness And Preventive Care Benefit',
        body: 'A. Benefit. We will reimburse the cost of routine and preventive care of an Enrolled Pet, including annual examination, vaccination, parasite prevention and dental cleaning, up to the annual wellness amount shown in the Schedule.\nB. No Deductible. The policy deductible and reimbursement percentage do not apply to this benefit; covered wellness costs are reimbursed at one hundred percent up to the scheduled amount.\nC. Limitation. Amounts unused in a policy year do not carry forward to any later policy year.',
      },
      {
        suffixNo: '6240',
        title: 'Travel And Boarding Interruption Benefit',
        body: 'A. Boarding Benefit. If the named insured is hospitalized for more than forty-eight consecutive hours during the policy period, we will reimburse reasonable boarding fees for the Enrolled Pet, up to the daily and aggregate amounts shown in the Schedule.\nB. Trip Interruption. If a covered Accident or Illness of the Enrolled Pet requires emergency treatment while the named insured is traveling more than one hundred miles from home, we will reimburse the reasonable additional cost of returning home early, up to the amount shown in the Schedule.',
      },
    ],
    decItems: [
      'Named Insured And Mailing Address',
      'Enrolled Pet Name Breed And Date Of Birth',
      'Policy Period And Waiting Periods',
      'Annual Benefit Limit',
      'Reimbursement Percentage And Annual Deductible',
      'Benefit Schedule - Purchase Protection And Warranty',
      'Sponsoring Program Identifier',
      'Total Policy Premium',
    ],
  },
};
